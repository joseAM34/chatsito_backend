import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from '../database/prisma.module';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeInterceptor } from './realtime.interceptor';

@Module({
  imports: [PrismaModule],
  providers: [RealtimeGateway, { provide: APP_INTERCEPTOR, useClass: RealtimeInterceptor }],
})
export class RealtimeModule {}
