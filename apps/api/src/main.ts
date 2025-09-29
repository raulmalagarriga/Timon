import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { PrismaService } from './prisma/prisma.service';
import { TenantContextMiddleware } from './common/middleware/tenant-context.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());

  const prisma = app.get(PrismaService);

  await app.listen(3001);
}
bootstrap();
