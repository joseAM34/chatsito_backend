import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { ForwardMessageDto } from './dto/forward-message.dto';
import { MessageResponse, Archivo } from './interfaces/message-response.interface';
import { Prisma } from '../../generated/prisma/client';

type MessageWithArchivo = Prisma.mensajesGetPayload<{
  include: {
    archivos: true;
    lecturas_mensajes: true;
  };
}>;

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async createMessage(
    conversationId: string,
    dto: CreateMessageDto,
    currentUser: CurrentUser,
  ): Promise<MessageResponse> {
    const conversationIdBigInt = BigInt(conversationId);
    const currentUserIdBigInt = BigInt(currentUser.id_usuario);

    // Verificar que la conversación existe y el usuario es participante
    const participant = await this.prisma.participantes.findUnique({
      where: {
        id_conversacion_id_usuario: {
          id_conversacion: conversationIdBigInt,
          id_usuario: currentUserIdBigInt,
        },
      },
    });

    if (!participant) {
      throw new NotFoundException('Conversación no encontrada o no eres participante');
    }

    // Crear mensaje
    const message: MessageWithArchivo = await this.prisma.mensajes.create({
      data: {
        id_conversacion: conversationIdBigInt,
        id_remitente: currentUserIdBigInt,
        contenido: dto.contenido,
        tipo: 'texto',
      },
      include: {
        archivos: true,
        lecturas_mensajes: true,
      },
    });

    // Obtener el remitente por separado
    const remitente = await this.prisma.usuarios.findUnique({
      where: { id_usuario: currentUserIdBigInt },
      select: {
        id_usuario: true,
        nombre: true,
      },
    });

    if (!remitente) {
      throw new NotFoundException('Remitente no encontrado');
    }

    return this.toMessageResponseWithRemitente(message, remitente);
  }

  async getMessages(
    conversationId: string,
    currentUser: CurrentUser,
    limit?: string,
    antesDe?: string,
    despuesDe?: string,
  ): Promise<MessageResponse[]> {
    const conversationIdBigInt = BigInt(conversationId);
    const currentUserIdBigInt = BigInt(currentUser.id_usuario);

    // Verificar que el usuario es participante
    const participant = await this.prisma.participantes.findUnique({
      where: {
        id_conversacion_id_usuario: {
          id_conversacion: conversationIdBigInt,
          id_usuario: currentUserIdBigInt,
        },
      },
    });

    if (!participant) {
      throw new NotFoundException('Conversación no encontrada o no eres participante');
    }

    const limitNumber = Math.min(parseInt(limit || '50', 10), 100);

    let where: Prisma.mensajesWhereInput = {
      id_conversacion: conversationIdBigInt,
    };

    let orderBy: Prisma.mensajesOrderByWithRelationInput = {
      id_mensaje: 'asc',
    };

    if (antesDe) {
      where.id_mensaje = { lt: BigInt(antesDe) };
      orderBy = { id_mensaje: 'desc' };
    } else if (despuesDe) {
      where.id_mensaje = { gt: BigInt(despuesDe) };
      orderBy = { id_mensaje: 'asc' };
    } else {
      // Sin cursor: devolver los últimos
      orderBy = { id_mensaje: 'desc' };
    }

    const messages: MessageWithArchivo[] = await this.prisma.mensajes.findMany({
      where,
      include: {
        lecturas_mensajes: true,
        archivos: true,
      },
      orderBy,
      take: limitNumber,
    });

    // Invertir el orden para que siempre sea de más antiguo a más nuevo
    const reversed = messages.reverse();

    // Obtener todos los remitentes en una sola consulta
    const remitenteIds = [...new Set(reversed.map((m) => m.id_remitente))];
    const remitentes = await this.prisma.usuarios.findMany({
      where: {
        id_usuario: { in: remitenteIds },
      },
      select: {
        id_usuario: true,
        nombre: true,
      },
    });

    const remitenteMap = new Map(
      remitentes.map((r) => [r.id_usuario.toString(), r]),
    );

    return reversed.map((msg: MessageWithArchivo) => {
      const remitente = remitenteMap.get(msg.id_remitente.toString());
      const leidoPor = msg.lecturas_mensajes
        ? msg.lecturas_mensajes.map((lm) => lm.id_usuario.toString())
        : [];

      const archivo: Archivo | null = msg.archivos
        ? {
            id_archivo: msg.archivos.id_archivo.toString(),
            nombre: msg.archivos.nombre,
            formato: msg.archivos.formato,
            tamano_bytes: Number(msg.archivos.tamano_bytes),
            duracion_segundos: msg.archivos.duracion_segundos,
          }
        : null;

      return {
        id_mensaje: msg.id_mensaje.toString(),
        id_conversacion: msg.id_conversacion.toString(),
        id_remitente: msg.id_remitente.toString(),
        contenido: msg.contenido,
        tipo: msg.tipo,
        fecha_envio: msg.fecha_envio,
        editado_en: msg.editado_en,
        reenviado_de_id: msg.reenviado_de_id?.toString() ?? null,
        remitente: {
          id_usuario: remitente!.id_usuario.toString(),
          nombre: remitente!.nombre,
        },
        leido_por: leidoPor,
        archivo,
      };
    });
  }

  async updateMessage(
    messageId: string,
    dto: UpdateMessageDto,
    currentUser: CurrentUser,
  ): Promise<MessageResponse> {
    const messageIdBigInt = BigInt(messageId);
    const currentUserIdBigInt = BigInt(currentUser.id_usuario);

    const message = await this.prisma.mensajes.findUnique({
      where: { id_mensaje: messageIdBigInt },
    });

    if (!message) {
      throw new NotFoundException('Mensaje no encontrado');
    }

    if (message.id_remitente !== currentUserIdBigInt) {
      throw new ForbiddenException('Solo el remitente puede editar el mensaje');
    }

    if (message.tipo !== 'texto') {
      throw new BadRequestException('Solo se pueden editar mensajes de texto');
    }

    if (Date.now() >= message.fecha_envio.getTime() + 15 * 60 * 1000) {
      throw new ForbiddenException('El plazo de 15 minutos para editar este mensaje ha terminado');
    }

    const updated: MessageWithArchivo = await this.prisma.mensajes.update({
      where: { id_mensaje: messageIdBigInt },
      data: {
        contenido: dto.contenido,
        editado_en: new Date(),
      },
      include: {
        archivos: true,
        lecturas_mensajes: true,
      },
    });

    const remitente = await this.prisma.usuarios.findUnique({
      where: { id_usuario: message.id_remitente },
      select: {
        id_usuario: true,
        nombre: true,
      },
    });

    if (!remitente) {
      throw new NotFoundException('Remitente no encontrado');
    }

    return this.toMessageResponseWithRemitente(updated, remitente);
  }

  async forwardMessage(
    messageId: string,
    dto: ForwardMessageDto,
    currentUser: CurrentUser,
  ): Promise<MessageResponse> {
    const messageIdBigInt = BigInt(messageId);
    const destinationConversationIdBigInt = BigInt(dto.id_conversacion);
    const currentUserIdBigInt = BigInt(currentUser.id_usuario);

    // Verificar que el mensaje original existe
    const originalMessage = await this.prisma.mensajes.findUnique({
      where: { id_mensaje: messageIdBigInt },
    });

    if (!originalMessage) {
      throw new NotFoundException('Mensaje no encontrado');
    }

    if (originalMessage.tipo !== 'texto') {
      throw new BadRequestException('Solo se pueden reenviar mensajes de texto');
    }

    // Verificar que el usuario es participante de la conversación original
    const originalParticipant = await this.prisma.participantes.findUnique({
      where: {
        id_conversacion_id_usuario: {
          id_conversacion: originalMessage.id_conversacion,
          id_usuario: currentUserIdBigInt,
        },
      },
    });

    if (!originalParticipant) {
      throw new ForbiddenException('No tienes acceso al mensaje original');
    }

    // Verificar que el usuario es participante de la conversación destino
    const destinationParticipant = await this.prisma.participantes.findUnique({
      where: {
        id_conversacion_id_usuario: {
          id_conversacion: destinationConversationIdBigInt,
          id_usuario: currentUserIdBigInt,
        },
      },
    });

    if (!destinationParticipant) {
      throw new ForbiddenException('No eres participante de la conversación destino');
    }

    // Crear mensaje reenviado
    const forwarded: MessageWithArchivo = await this.prisma.mensajes.create({
      data: {
        id_conversacion: destinationConversationIdBigInt,
        id_remitente: currentUserIdBigInt,
        contenido: originalMessage.contenido,
        tipo: 'texto',
        reenviado_de_id: messageIdBigInt,
      },
      include: {
        archivos: true,
        lecturas_mensajes: true,
      },
    });

    const remitente = await this.prisma.usuarios.findUnique({
      where: { id_usuario: currentUserIdBigInt },
      select: {
        id_usuario: true,
        nombre: true,
      },
    });

    if (!remitente) {
      throw new NotFoundException('Remitente no encontrado');
    }

    return this.toMessageResponseWithRemitente(forwarded, remitente);
  }

  async markAsRead(
    conversationId: string,
    currentUser: CurrentUser,
  ): Promise<{ marcados: number }> {
    const conversationIdBigInt = BigInt(conversationId);
    const currentUserIdBigInt = BigInt(currentUser.id_usuario);

    // Verificar que el usuario es participante
    const participant = await this.prisma.participantes.findUnique({
      where: {
        id_conversacion_id_usuario: {
          id_conversacion: conversationIdBigInt,
          id_usuario: currentUserIdBigInt,
        },
      },
    });

    if (!participant) {
      throw new NotFoundException('Conversación no encontrada o no eres participante');
    }

    // Obtener mensajes de otros usuarios que aún no he leído
    const unreadMessages = await this.prisma.mensajes.findMany({
      where: {
        id_conversacion: conversationIdBigInt,
        id_remitente: { not: currentUserIdBigInt },
        lecturas_mensajes: {
          none: {
            id_usuario: currentUserIdBigInt,
          },
        },
      },
      select: {
        id_mensaje: true,
      },
    });

    if (unreadMessages.length === 0) {
      return { marcados: 0 };
    }

    // Crear registros de lectura
    await this.prisma.lecturas_mensajes.createMany({
      data: unreadMessages.map((msg) => ({
        id_conversacion: conversationIdBigInt,
        id_mensaje: msg.id_mensaje,
        id_usuario: currentUserIdBigInt,
      })),
      skipDuplicates: true,
    });

    return { marcados: unreadMessages.length };
  }

  private toMessageResponseWithRemitente(
    message: MessageWithArchivo,
    remitente: { id_usuario: bigint; nombre: string },
  ): MessageResponse {
    const leidoPor = message.lecturas_mensajes
      ? message.lecturas_mensajes.map((lm) => lm.id_usuario.toString())
      : [];

    const archivo: Archivo | null = message.archivos
      ? {
          id_archivo: message.archivos.id_archivo.toString(),
          nombre: message.archivos.nombre,
          formato: message.archivos.formato,
          tamano_bytes: Number(message.archivos.tamano_bytes),
          duracion_segundos: message.archivos.duracion_segundos,
        }
      : null;

    return {
      id_mensaje: message.id_mensaje.toString(),
      id_conversacion: message.id_conversacion.toString(),
      id_remitente: message.id_remitente.toString(),
      contenido: message.contenido,
      tipo: message.tipo,
      fecha_envio: message.fecha_envio,
      editado_en: message.editado_en,
      reenviado_de_id: message.reenviado_de_id?.toString() ?? null,
      remitente: {
        id_usuario: remitente.id_usuario.toString(),
        nombre: remitente.nombre,
      },
      leido_por: leidoPor,
      archivo,
    };
  }
}
