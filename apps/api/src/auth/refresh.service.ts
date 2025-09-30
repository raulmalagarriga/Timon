import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getRefreshCookie, sha256, setRefreshCookie, clearRefreshCookie, accessTtlSeconds } from './jwt.util';
import { Response, Request } from 'express';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class RefreshService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async rotate(req: Request, res: Response) {
    const token = getRefreshCookie(req);
    if (!token) throw new UnauthorizedException('No refresh token');

    let payload: any;
    try {
      payload = this.jwt.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const hash = sha256(token);
    const dbToken = await this.prisma.refreshToken.findFirst({
      where: { tokenHash: hash, revokedAt: null },
    });
    if (!dbToken || dbToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh expired or revoked');
    }

    // Rotación: revoca el actual y emite uno nuevo en la misma "familia"
    const familyId = dbToken.familyId;
    const now = new Date();

    const next = this.jwt.sign({ sub: dbToken.userId, tenant_id: dbToken.tenantId, familyId });
    const nextHash = sha256(next);

    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: dbToken.id },
        data: { revokedAt: now },
      }),
      this.prisma.refreshToken.create({
        data: {
          userId: dbToken.userId,
          tenantId: dbToken.tenantId,
          tokenHash: nextHash,
          familyId,
          expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        },
      }),
    ]);

    setRefreshCookie(res, next);

    const access = this.jwt.sign({
      sub: dbToken.userId,
      tenant_id: dbToken.tenantId,
      email: '', // opcional: puedes guardar email en otra tabla/claim si quieres
      role: 'owner',
    });

    return { accessToken: access, accessTokenExpiresIn: accessTtlSeconds() };
  }

  async revoke(req: Request, res: Response) {
    const token = getRefreshCookie(req);
    if (token) {
      const hash = sha256(token);
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash: hash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    clearRefreshCookie(res);
    return { ok: true };
  }
}
