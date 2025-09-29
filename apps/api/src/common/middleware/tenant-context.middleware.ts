import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private prisma: PrismaService) {}

  async use(req: Request & { user?: any }, res: Response, next: NextFunction) {
    const header = req.headers.authorization?.split(' ')[1];
    if (header) {
      try {
        const p = jwt.verify(header, process.env.JWT_ACCESS_SECRET!) as any;
        req.user = { id: p.sub, tenantId: p.tenant_id, role: p.role, email: p.email };
        await this.prisma.$executeRawUnsafe(
          `SELECT set_config('app.tenant_id', $1, true)`,
          p.tenant_id
        );
      } catch {
        // token inválido/ausente: continúa (rutas públicas como /auth/register /auth/login)
      }
    }
    next();
  }
}
