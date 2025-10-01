import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class EmployeesService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  private orderByForList() {
    return [{ position: 'asc' as const }, { name: 'asc' as const }];
  }

  async list(tenantId: string, params: { q?: string; active?: boolean; take?: number; cursor?: string }) {
    const { q, active, take = 20, cursor } = params;

    const where: Prisma.EmployeeWhereInput = { tenantId };
    if (typeof active === 'boolean') where.active = active;
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
      ];
    }

    const findArgs: Prisma.EmployeeFindManyArgs = {
      where,
      orderBy: this.orderByForList(),
      take: Math.min(Math.max(take, 1), 100),
    };

    if (cursor) {
      findArgs.skip = 1;
      findArgs.cursor = { id: cursor };
    }

    const items = await this.prisma.employee.findMany(findArgs);
    const nextCursor = items.length === findArgs.take ? items[items.length - 1].id : null;

    return { items, nextCursor };
  }

  async get(tenantId: string, id: string) {
    const emp = await this.prisma.employee.findFirst({ where: { id, tenantId } });
    if (!emp) throw new NotFoundException('Empleado no encontrado');
    return emp;
  }

  async create(tenantId: string, dto: CreateEmployeeDto) {
    try {
      const emp = await this.prisma.employee.create({
        data: { tenantId, ...dto },
      });
      await this.rebuildActiveList(tenantId);
      return emp;
    } catch (e: any) {
      this.handleUniqueName(tenantId, dto, e);
      throw e;
    }
  }

  async update(tenantId: string, id: string, dto: UpdateEmployeeDto) {
    const before = await this.get(tenantId, id);
    try {
      const emp = await this.prisma.employee.update({
        where: { id },
        data: {
          ...dto,
          // garantiza que no cambien de tenant (por RLS igual no podrían)
          tenantId: before.tenantId,
        },
      });
      // Si cambió algo que afecte la lista (active o position o name), la reconstruimos
      if (
        typeof dto.active === 'boolean' ||
        typeof dto.position === 'number' ||
        typeof dto.name === 'string'
      ) {
        await this.rebuildActiveList(tenantId);
      }
      return emp;
    } catch (e: any) {
      this.handleUniqueName(tenantId, dto, e);
      throw e;
    }
  }

  async remove(tenantId: string, id: string) {
    const emp = await this.get(tenantId, id);
    await this.prisma.employee.delete({ where: { id: emp.id } });
    await this.rebuildActiveList(tenantId);
    return { ok: true };
  }

  async toggleActive(tenantId: string, id: string) {
    const emp = await this.get(tenantId, id);
    const updated = await this.prisma.employee.update({
      where: { id },
      data: { active: !emp.active },
    });
    await this.rebuildActiveList(tenantId);
    return updated;
  }

  /** Reconstruye la lista de activos en Redis con el orden natural (position, name) */
  private async rebuildActiveList(tenantId: string) {
    const actives = await this.prisma.employee.findMany({
      where: { tenantId, active: true },
      orderBy: this.orderByForList(),
      select: { id: true },
    });
    await this.redis.replaceActiveList(tenantId, actives.map(a => a.id));
  }

  private handleUniqueName(tenantId: string, dto: { name?: string }, e: any) {
    if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
      // Índice único en (tenantId, name)
      if (dto?.name) {
        throw new BadRequestException(`Ya existe un empleado con el nombre "${dto.name}"`);
      }
      throw new BadRequestException('Ya existe un empleado con esos datos');
    }
  }
}
