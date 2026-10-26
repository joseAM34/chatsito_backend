import { Controller, Delete, Get, Post, Patch, Body, Param, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { ForwardMessageDto } from './dto/forward-message.dto';
import { MessageResponse } from './interfaces/message-response.interface';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post(':id/messages')
  async createMessage(
    @Param('id') id: string,
    @Body() dto: CreateMessageDto,
    @CurrentUser() currentUser: CurrentUser,
  ): Promise<MessageResponse> {
    if (!/^\d+$/.test(id)) {
      throw new BadRequestException('id debe ser un número');
    }
    return this.messagesService.createMessage(id, dto, currentUser);
  }

  @Get(':id/messages')
  async getMessages(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentUser,
    @Query('limit') limit?: string,
    @Query('antes_de') antesDe?: string,
    @Query('despues_de') despuesDe?: string,
  ): Promise<MessageResponse[]> {
    if (!currentUser) {
      throw new BadRequestException('Usuario no autenticado');
    }
    if (!/^\d+$/.test(id)) {
      throw new BadRequestException('id debe ser un número');
    }
    if (antesDe && !/^\d+$/.test(antesDe)) {
      throw new BadRequestException('antes_de debe ser un número');
    }
    if (despuesDe && !/^\d+$/.test(despuesDe)) {
      throw new BadRequestException('despues_de debe ser un número');
    }
    return this.messagesService.getMessages(id, currentUser, limit, antesDe, despuesDe);
  }

  @Post(':id/messages/read')
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentUser,
  ): Promise<{ marcados: number }> {
    if (!/^\d+$/.test(id)) {
      throw new BadRequestException('id debe ser un número');
    }
    return this.messagesService.markAsRead(id, currentUser);
  }
}

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesControllerV2 {
  constructor(private readonly messagesService: MessagesService) {}

  @Delete(':id')
  async deleteMessage(@Param('id') id: string, @CurrentUser() user: CurrentUser) {
    if (!/^\d+$/.test(id)) throw new BadRequestException('id inv?lido');
    return this.messagesService.deleteMessage(id, user);
  }

  @Patch(':id')
  async updateMessage(
    @Param('id') id: string,
    @Body() dto: UpdateMessageDto,
    @CurrentUser() currentUser: CurrentUser,
  ): Promise<MessageResponse> {
    if (!/^\d+$/.test(id)) {
      throw new BadRequestException('id debe ser un número');
    }
    return this.messagesService.updateMessage(id, dto, currentUser);
  }

  @Post(':id/forward')
  async forwardMessage(
    @Param('id') id: string,
    @Body() dto: ForwardMessageDto,
    @CurrentUser() currentUser: CurrentUser,
  ): Promise<MessageResponse> {
    if (!/^\d+$/.test(id)) {
      throw new BadRequestException('id debe ser un número');
    }
    return this.messagesService.forwardMessage(id, dto, currentUser);
  }
}
