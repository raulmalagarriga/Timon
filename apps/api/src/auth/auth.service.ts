// apps/api/src/auth/auth.service.ts
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';
import { sha256, setRefreshCookie, accessTtlSeconds } from './jwt.util';
import { Response } from 'express';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async register(input: { businessName: string; name: string; email: string; password: string }, res: Response) {
    const exists = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (exists) throw new BadRequestException('Email ya registrado');

    const hash = await argon2.hash(input.password);

    const { user, tenant } = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: input.email, name: input.name, passwordHash: hash },
      });

      const tenant = await tx.tenant.create({
        data: { name: input.businessName, adminUserId: user.id },
      });

      // Crea el canal vacío (opcional en registro)
      await tx.channel.create({
        data: {
          tenantId: tenant.id,
          waPhoneNumberId: 'TO-DO',
          waBusinessId: 'TO-DO',
          displayName: 'Principal',
          status: 'inactive',
        },
      });

      return { user, tenant };
    });

    // Emite tokens
    const access = this.jwt.sign({
      sub: user.id,
      tenant_id: tenant.id,
      email: user.email,
      role: 'owner',
    });

    // Nueva familia de refresh
    const familyId = cryptoRandomId();
    const refresh = this.jwt.sign({ sub: user.id, tenant_id: tenant.id, familyId });
    const refreshHash = sha256(refresh);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tenantId: tenant.id,
        tokenHash: refreshHash,
        familyId,
        expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      },
    });

    setRefreshCookie(res, refresh);

    return {
      accessToken: access,
      accessTokenExpiresIn: accessTtlSeconds(),
      user: { id: user.id, email: user.email, name: user.name },
      tenant: { id: tenant.id, name: tenant.name },
    };
  }

  async login(input: { email: string; password: string }, res: Response) {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    const ok = await argon2.verify(user.passwordHash, input.password);
    if (!ok) throw new UnauthorizedException('Credenciales inválidas');

    // Busca su tenant (adminUserId)
    const tenant = await this.prisma.tenant.findFirst({ where: { adminUserId: user.id } });
    if (!tenant) throw new UnauthorizedException('Usuario sin tenant');

    const access = this.jwt.sign({
      sub: user.id,
      tenant_id: tenant.id,
      email: user.email,
      role: 'owner',
    });

    // Nueva familia de refresh (o podrías reusar por IP/UA; mantengo simple)
    const familyId = cryptoRandomId();
    const refresh = this.jwt.sign({ sub: user.id, tenant_id: tenant.id, familyId });
    const refreshHash = sha256(refresh);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tenantId: tenant.id,
        tokenHash: refreshHash,
        familyId,
        expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      },
    });

    setRefreshCookie(res, refresh);

    return {
      accessToken: access,
      accessTokenExpiresIn: accessTtlSeconds(),
      user: { id: user.id, email: user.email, name: user.name },
      tenant: { id: tenant.id, name: tenant.name },
    };
  }
}

function cryptoRandomId() {
  // id corto para familyId
  return [...crypto.getRandomValues(new Uint32Array(4))].map(n => n.toString(16)).join('');
}


// Nota: Node 18+ tiene crypto web; si usas Node <19, reemplaza por:
// import * as crypto from 'crypto';
// function cryptoRandomId() { return crypto.randomBytes(16).toString('hex'); }
