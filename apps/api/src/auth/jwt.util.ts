// apps/api/src/auth/jwt.util.ts
import * as crypto from 'crypto';
import { Response, Request } from 'express';

const ACCESS_TTL_SEC = 15 * 60; // 15 min
const REFRESH_TTL_DAYS = parseInt(process.env.REFRESH_TTL_DAYS || '30', 10);

export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function setRefreshCookie(res: Response, token: string) {
  // El refresh sólo se usa en /auth/refresh
  res.cookie('refresh_token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/auth/refresh',
    maxAge: REFRESH_TTL_DAYS * 24 * 3600 * 1000,
  });
}

export function getRefreshCookie(req: Request): string | null {
  // requiere cookie-parser en main.ts
  return (req as any).cookies?.['refresh_token'] ?? null;
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie('refresh_token', { path: '/auth/refresh' });
}

export function accessTtlSeconds() {
  return ACCESS_TTL_SEC;
}
