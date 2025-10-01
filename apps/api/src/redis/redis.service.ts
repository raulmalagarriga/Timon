import { Injectable, OnModuleDestroy } from '@nestjs/common';
import IORedis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  public client: IORedis;

  constructor() {
    this.client = new IORedis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  keyActiveList(tenantId: string) {
    return `tenant:${tenantId}:employees_active`;
  }

  keyRoundRobinIndex(tenantId: string) {
    return `tenant:${tenantId}:rr_idx`;
  }

  /** Reemplaza la lista de activos en orden (position asc, luego name asc) */
  async replaceActiveList(tenantId: string, employeeIdsInOrder: string[]) {
    const key = this.keyActiveList(tenantId);
    const multi = this.client.multi();
    multi.del(key);
    if (employeeIdsInOrder.length) {
      multi.rpush(key, ...employeeIdsInOrder);
    }
    return multi.exec();
  }

  /** Devuelve el próximo ID para round-robin */
  async nextEmployeeId(tenantId: string): Promise<string | null> {
    const listKey = this.keyActiveList(tenantId);
    const idxKey = this.keyRoundRobinIndex(tenantId);

    const len = await this.client.llen(listKey);
    if (!len) return null;

    const idx = (await this.client.incr(idxKey)) % len;
    return this.client.lindex(listKey, idx);
  }
}
