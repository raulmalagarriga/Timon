// apps/api/src/common/guards/auth.guard.ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest() as any;
    const header = req.headers.authorization?.split(' ')[1];
    if (!header) throw new UnauthorizedException('Missing access token');
    try {
      const p = this.jwt.verify(header);
      // Si quieres, aquí puedes inyectar req.user; tu middleware ya lo hace.
      req.user = { id: p.sub, tenantId: p.tenant_id, email: p.email, role: p.role };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
