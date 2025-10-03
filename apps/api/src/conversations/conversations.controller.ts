import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { ListConvQuerySchema } from './dto/list-conv.query';
import { UpdateConvSchema } from './dto/update-conv.dto';
import { SendMessageSchema } from './dto/send-message.dto';

@UseGuards(AuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(private svc: ConversationsService) {}

  @Get()
  async list(@Req() req: any, @Query() rawQuery: any) {
    const tenantId = req.user.tenantId as string;
    const q = ListConvQuerySchema.partial().parse(rawQuery);
    return this.svc.list(tenantId, q as any);
  }

  @Get(':id')
  async get(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.user.tenantId as string;
    return this.svc.get(tenantId, id);
  }

  @Get(':id/messages')
  async listMessages(
    @Req() req: any,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('take') takeStr?: string,
  ) {
    const tenantId = req.user.tenantId as string;
    const take = takeStr ? Math.min(Math.max(parseInt(takeStr, 10), 1), 200) : 50;
    return this.svc.listMessages(tenantId, id, cursor, take);
  }

  @Patch(':id')
  async patch(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const tenantId = req.user.tenantId as string;
    const dto = UpdateConvSchema.parse(body);
    return this.svc.patch(tenantId, id, dto, req.user.id);
  }

  @Post(':id/messages')
  async sendMessage(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const tenantId = req.user.tenantId as string;
    const dto = SendMessageSchema.parse(body);
    return this.svc.sendMessage(tenantId, id, dto, req.user.id);
  }
}
