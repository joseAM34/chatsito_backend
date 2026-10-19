import { Module } from '@nestjs/common';
import { MessagesController, MessagesControllerV2 } from './messages.controller';
import { MessagesService } from './messages.service';
import { PrismaModule } from '../../database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MessagesController, MessagesControllerV2],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
