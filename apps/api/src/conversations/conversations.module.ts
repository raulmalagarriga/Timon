import { Module } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { PrismaService } from '../prisma/prisma.service';
import { WaService } from '../wa/wa.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ConversationsController],
  providers: [ConversationsService, PrismaService, WaService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
