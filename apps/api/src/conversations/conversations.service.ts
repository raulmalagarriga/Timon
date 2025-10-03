import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { ListConvQuery } from './dto/list-conv.query';
import { UpdateConvDto } from './dto/update-conv.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { assertTransition, ConvStatus } from './domain/status';
import { WaService } from '../wa/wa.service';

@Injectable()
export class ConversationsService {
  constructor(
    private prisma: PrismaService,
    private wa: WaService,
  ) {}

  async list(tenantId: string, q: ListConvQuery) {
    const take = q.take ? Math.min(Math.max(q.take, 1), 100) : 20;

    const where: Prisma.ConversationWhereInput = { tenantId };
    if (q.status) where.status = q.status as any;
    if (q.assigneeId) where.assigneeId = q.assigneeId;
    if (q.q) {
      where.OR = [
        { contact: { name: { contains: q.q, mode: 'insensitive' } } },
        { contact: { waPhone: { contains: q.q, mode: 'insensitive' } } },
      ];
    }

    const args: Prisma.ConversationFindManyArgs = {
      where,
      orderBy: [{ lastMsgAt: 'desc' }],
      take,
      include: {
        contact: true,
        assignee: true,
        labels: { include: { label: true } },
      },
    };

    if (q.cursor) {
      args.skip = 1;
      args.cursor = { id: q.cursor };
    }

    const items = await this.prisma.conversation.findMany(args);
    const nextCursor = items.length === take ? items[items.length - 1].id : null;

    return { items, nextCursor };
  }

  async get(tenantId: string, id: string) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id, tenantId },
      include: {
        contact: true,
        assignee: true,
        labels: { include: { label: true } },
      },
    });
    if (!conv) throw new NotFoundException('Conversación no encontrada');
    return conv;
  }

  async patch(tenantId: string, id: string, dto: UpdateConvDto, adminUserId?: string) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id, tenantId },
      include: { labels: true },
    });
    if (!conv) throw new NotFoundException('Conversación no encontrada');

    // Validar transición de estado
    if (dto.status) {
      try { assertTransition(conv.status as ConvStatus, dto.status as ConvStatus); }
      catch (e: any) { throw new BadRequestException(e.message); }
    }

    // Prepara cambios
    const data: Prisma.ConversationUpdateInput = {};
    const events: Prisma.ConversationEventCreateManyInput[] = [];

    if (dto.status && dto.status !== conv.status) {
      data.status = dto.status as any;
      events.push({
        tenantId, conversationId: conv.id,
        adminUserId,
        type: 'status_change',
        from: { status: conv.status },
        to: { status: dto.status },
        createdAt: new Date(),
        id: cryptoRandomId(), // opcional, Prisma genera UUID si lo omites
      });
      // Si terminal:
      if (dto.status === 'completado' || dto.status === 'cerrado') {
        (data as any).closedAt = new Date();
      }
    }

    if (dto.assigneeId !== undefined) {
      // null => desasignar
      if (dto.assigneeId === null) {
        if (conv.assigneeId) {
          (data as any).assigneeId = null;
          events.push({
            tenantId, conversationId: conv.id,
            adminUserId,
            type: 'unassign',
            from: { assigneeId: conv.assigneeId },
            to: { assigneeId: null },
            createdAt: new Date(),
            id: cryptoRandomId(),
          });
        }
      } else {
        // validar que el empleado existe y pertenece al tenant
        const emp = await this.prisma.employee.findFirst({ where: { id: dto.assigneeId, tenantId } });
        if (!emp) throw new BadRequestException('Empleado inválido');
        if (conv.assigneeId !== dto.assigneeId) {
          (data as any).assigneeId = dto.assigneeId;
          events.push({
            tenantId, conversationId: conv.id,
            adminUserId,
            type: 'assign',
            from: { assigneeId: conv.assigneeId },
            to: { assigneeId: dto.assigneeId },
            createdAt: new Date(),
            id: cryptoRandomId(),
          });
        }
      }
    }

    // Reemplazar labels si viene labelIds
    let labelOps: Prisma.ConversationLabelCreateManyInput[] | undefined;
    if (dto.labelIds) {
      // valida que existan y sean del mismo tenant
      const count = await this.prisma.label.count({
        where: { tenantId, id: { in: dto.labelIds } },
      });
      if (count !== dto.labelIds.length) throw new BadRequestException('Una o más etiquetas no existen');

      labelOps = dto.labelIds.map(l => ({
        id: cryptoRandomId(),
        conversationId: conv.id,
        labelId: l,
      }));
    }

    // Nota interna como evento
    if (dto.note && dto.note.trim().length) {
      events.push({
        tenantId, conversationId: conv.id,
        adminUserId,
        type: 'note',
        from: Prisma.JsonNull,
        to: { note: dto.note },
        createdAt: new Date(),
        id: cryptoRandomId(),
      });
    }

    // Aplica transacción
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.conversation.update({
        where: { id: conv.id },
        data,
      });

      if (dto.labelIds) {
        await tx.conversationLabel.deleteMany({ where: { conversationId: conv.id } });
        if (labelOps!.length) {
          await tx.conversationLabel.createMany({ data: labelOps! });
        }
      }

      if (events.length) {
        await tx.conversationEvent.createMany({ data: events });
      }

      return updated;
    });

    return this.get(tenantId, id);
  }

  async listMessages(tenantId: string, conversationId: string, cursor?: string, take = 50) {
    // asegura que la conversación existe para este tenant
    const conv = await this.prisma.conversation.findFirst({ where: { id: conversationId, tenantId } });
    if (!conv) throw new NotFoundException('Conversación no encontrada');

    const args: Prisma.MessageFindManyArgs = {
      where: { tenantId, conversationId },
      orderBy: [{ createdAt: 'asc' }], // en UI quizá convenga ascendente
      take: Math.min(Math.max(take, 1), 200),
    };
    if (cursor) {
      args.skip = 1;
      args.cursor = { id: cursor };
    }
    const items = await this.prisma.message.findMany(args);
    const nextCursor = items.length === args.take ? items[items.length - 1].id : null;
    return { items, nextCursor };
  }

  async sendMessage(tenantId: string, conversationId: string, dto: SendMessageDto, adminUserId?: string) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      include: { contact: true, channel: true },
    });
    if (!conv) throw new NotFoundException('Conversación no encontrada');

    // Validaciones mínimas por tipo
    if (dto.type === 'text' && !dto.text) {
      throw new BadRequestException('Falta "text" para type=text');
    }
    if ((dto.type === 'image' || dto.type === 'document' || dto.type === 'audio') && !dto.mediaUrl) {
      throw new BadRequestException('Falta "mediaUrl" para media');
    }
    if (dto.type === 'template' && !dto.template) {
      throw new BadRequestException('Falta "template" para type=template');
    }

    // Enviar a WhatsApp Cloud API
    const waResp = await this.wa.sendMessage(
      conv.channel.waPhoneNumberId,
      process.env.WA_ACCESS_TOKEN!,
      {
        toPhoneE164: conv.contact.waPhone,
        type: dto.type as any,
        text: dto.text,
        mediaUrl: dto.mediaUrl,
        template: dto.template as any
      }
    );

    // Persistir Message (out)
    const now = new Date();
    const msg = await this.prisma.message.create({
      data: {
        tenantId,
        conversationId: conv.id,
        direction: 'out',
        waMessageId: waResp?.messages?.[0]?.id ?? null,
        type: dto.type as any,
        content: {
          text: dto.text ?? null,
          mediaUrl: dto.mediaUrl ?? null,
          template: dto.template ?? null,
          wa_response: waResp ?? null,
        },
        adminUserId: adminUserId ?? null,
        createdAt: now,
      }
    });

    // Actualizar métricas de conversación
    await this.prisma.conversation.update({
      where: { id: conv.id },
      data: {
        lastMsgAt: now,
        lastAgentMsgAt: now,
        // en caso de primer out, estado puede pasar a 'pendiente' o 'atendiendo' según tu preferencia
        // status: conv.status === 'nuevo' ? 'pendiente' : conv.status
      }
    });

    return msg;
  }
}

function cryptoRandomId() {
  // Node 18+: usa Web Crypto si está, sino random
  if ((global as any).crypto?.getRandomValues) {
    return [...(global as any).crypto.getRandomValues(new Uint32Array(4))].map(n => n.toString(16)).join('');
  } else {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = require('crypto');
    return nodeCrypto.randomBytes(16).toString('hex');
  }
}
