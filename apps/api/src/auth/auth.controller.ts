import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterSchema } from './dto/register.dto';
import { LoginSchema } from './dto/login.dto';
import { RefreshService } from './refresh.service';
import type { Request, Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private refreshSvc: RefreshService,
  ) {}

  @Post('register')
  async register(@Body() body: any, @Res() res: Response) {
    const input = RegisterSchema.parse(body);
    const out = await this.auth.register(input, res);
    return res.json(out);
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: any, @Res() res: Response) {
    const input = LoginSchema.parse(body);
    const out = await this.auth.login(input, res);
    return res.json(out);
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res() res: Response) {
    const out = await this.refreshSvc.rotate(req, res);
    return res.json(out);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res() res: Response) {
    await this.refreshSvc.revoke(req, res);
    return res.end();
  }
}