import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreatePrivateDto } from './dto/create-private.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { AddParticipantDto } from './dto/add-participant.dto';

@Injectable()
export class ConversationsService {
  constructor(private prisma: PrismaService) {}

  async createPrivate(dto: CreatePrivateDto, currentUser: CurrentUser) {
    const otherUserId = BigInt(dto.id_usuario);

    if (otherUserId === BigInt(currentUser.id_usuario)) {
      throw new ConflictException('No puedes crear una conversación contigo mismo');
    }

    const otherUser = await this.prisma.usuarios.findUnique({
      where: { id_usuario: otherUserId },
    });

    if (!otherUser) {
      throw new NotFoundException('El usuario no existe');
    }

    // Verificar si ya existe una conversación privada entre ambos
    const existingConversation = await this.prisma.conversaciones.findFirst({
      where: {
        tipo: 'privada',
        participantes: {
          some: {
            id_usuario: BigInt(currentUser.id_usuario),
          },
        },
        AND: {
          participantes: {
            some: {
              id_usuario: otherUserId,
            },
          },
        },
      },
      include: {
        participantes: {
          include: {
            usuarios: {
              select: {
                id_usuario: true,
                nombre: true,
              },
            },
          },
        },
      },
    });

    if (existingConversation) {
      return {
        id_conversacion: existingConversation.id_conversacion.toString(),
        tipo: existingConversation.tipo,
        nombre: existingConversation.nombre,
        fecha_creacion: existingConversation.fecha_creacion,
        participantes: existingConversation.participantes.map((p) => ({
          id_usuario: p.usuarios.id_usuario.toString(),
          nombre: p.usuarios.nombre,
        })),
      };
    }

    // Crear nueva conversación privada con transacción
    const conversation = await this.prisma.$transaction(async (tx) => {
      const newConversation = await tx.conversaciones.create({
        data: {
          tipo: 'privada',
        },
      });

      await tx.participantes.createMany({
        data: [
          {
            id_conversacion: newConversation.id_conversacion,
            id_usuario: BigInt(currentUser.id_usuario),
          },
          {
            id_conversacion: newConversation.id_conversacion,
            id_usuario: otherUserId,
          },
        ],
      });

      return newConversation;
    });

    const conversationWithParticipants = await this.prisma.conversaciones.findUnique({
      where: { id_conversacion: conversation.id_conversacion },
      include: {
        participantes: {
          include: {
            usuarios: {
              select: {
                id_usuario: true,
                nombre: true,
              },
            },
          },
        },
      },
    });

    if (!conversationWithParticipants) {
      throw new NotFoundException('Error al crear la conversación');
    }

    return {
      id_conversacion: conversationWithParticipants.id_conversacion.toString(),
      tipo: conversationWithParticipants.tipo,
      nombre: conversationWithParticipants.nombre,
      fecha_creacion: conversationWithParticipants.fecha_creacion,
      participantes: conversationWithParticipants.participantes.map((p) => ({
        id_usuario: p.usuarios.id_usuario.toString(),
        nombre: p.usuarios.nombre,
      })),
    };
  }

  async createGroup(dto: CreateGroupDto, currentUser: CurrentUser) {
    const participantIds = dto.participantes.map((id) => BigInt(id));

    // Verificar que todos los participantes existan
    const users = await this.prisma.usuarios.findMany({
      where: {
        id_usuario: { in: participantIds },
      },
    });

    if (users.length !== participantIds.length) {
      throw new NotFoundException('Algunos usuarios no existen');
    }

    // Crear grupo con transacción
    const conversation = await this.prisma.$transaction(async (tx) => {
      const newConversation = await tx.conversaciones.create({
        data: {
          tipo: 'grupo',
          nombre: dto.nombre,
        },
      });

      // Agregar al creador
      await tx.participantes.create({
        data: {
          id_conversacion: newConversation.id_conversacion,
          id_usuario: BigInt(currentUser.id_usuario),
        },
      });

      // Agregar a los otros participantes
      await tx.participantes.createMany({
        data: participantIds.map((id) => ({
          id_conversacion: newConversation.id_conversacion,
          id_usuario: id,
        })),
      });

      return newConversation;
    });

    const conversationWithParticipants = await this.prisma.conversaciones.findUnique({
      where: { id_conversacion: conversation.id_conversacion },
      include: {
        participantes: {
          include: {
            usuarios: {
              select: {
                id_usuario: true,
                nombre: true,
              },
            },
          },
        },
      },
    });

    if (!conversationWithParticipants) {
      throw new NotFoundException('Error al crear la conversación');
    }

    return {
      id_conversacion: conversationWithParticipants.id_conversacion.toString(),
      tipo: conversationWithParticipants.tipo,
      nombre: conversationWithParticipants.nombre,
      fecha_creacion: conversationWithParticipants.fecha_creacion,
      participantes: conversationWithParticipants.participantes.map((p) => ({
        id_usuario: p.usuarios.id_usuario.toString(),
        nombre: p.usuarios.nombre,
      })),
    };
  }

  async findAll(currentUser: CurrentUser) {
    const idUsuario = BigInt(currentUser.id_usuario);

    const conversations = await this.prisma.conversaciones.findMany({
      where: {
        participantes: {
          some: {
            id_usuario: idUsuario,
          },
        },
      },
      include: {
        participantes: {
          include: {
            usuarios: {
              select: {
                id_usuario: true,
                nombre: true,
              },
            },
          },
        },
      },
      orderBy: {
        fecha_creacion: 'desc',
      },
    });

    //cuántos mensajes sin leer tiene el usuario en cada conversación
    const pendientes = await this.prisma.mensajes.groupBy({
      by: ['id_conversacion'],
      where: {
        id_conversacion: { in: conversations.map((c) => c.id_conversacion) },
        id_remitente: { not: idUsuario },
        lecturas_mensajes: { none: { id_usuario: idUsuario } },
      },
      _count: { _all: true },
    });

    const noLeidosPorConversacion = new Map(
      pendientes.map((p) => [p.id_conversacion.toString(), p._count._all]),
    );

    return conversations.map((conv) => ({
      id_conversacion: conv.id_conversacion.toString(),
      tipo: conv.tipo,
      nombre: conv.nombre,
      fecha_creacion: conv.fecha_creacion,
      noLeidos: noLeidosPorConversacion.get(conv.id_conversacion.toString()) ?? 0, // 👈 nuevo
      participantes: conv.participantes.map((p) => ({
        id_usuario: p.usuarios.id_usuario.toString(),
        nombre: p.usuarios.nombre,
      })),
    }));
  }

  async findOne(id: string, currentUser: CurrentUser) {
    const conversationId = BigInt(id);

    const conversation = await this.prisma.conversaciones.findUnique({
      where: { id_conversacion: conversationId },
      include: {
        participantes: {
          include: {
            usuarios: {
              select: {
                id_usuario: true,
                nombre: true,
              },
            },
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversación no encontrada');
    }

    // Verificar que el usuario es participante
    const isParticipant = conversation.participantes.some(
      (p) => p.id_usuario === BigInt(currentUser.id_usuario),
    );

    if (!isParticipant) {
      throw new ForbiddenException('No tienes acceso a esta conversación');
    }

    return {
      id_conversacion: conversation.id_conversacion.toString(),
      tipo: conversation.tipo,
      nombre: conversation.nombre,
      fecha_creacion: conversation.fecha_creacion,
      participantes: conversation.participantes.map((p) => ({
        id_usuario: p.usuarios.id_usuario.toString(),
        nombre: p.usuarios.nombre,
        fecha_union: p.fecha_union,
      })),
    };
  }

  async addParticipant(id: string, dto: AddParticipantDto, currentUser: CurrentUser) {
    const conversationId = BigInt(id);
    const newUserId = BigInt(dto.id_usuario);

    const conversation = await this.prisma.conversaciones.findUnique({
      where: { id_conversacion: conversationId },
      include: {
        participantes: true,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversación no encontrada');
    }

    if (conversation.tipo !== 'grupo') {
      throw new ForbiddenException('Solo se pueden agregar participantes a grupos');
    }

    // Verificar que el usuario actual es participante
    const isParticipant = conversation.participantes.some(
      (p) => p.id_usuario === BigInt(currentUser.id_usuario),
    );

    if (!isParticipant) {
      throw new ForbiddenException('No tienes acceso a esta conversación');
    }

    // Verificar que el usuario a agregar existe
    const newUser = await this.prisma.usuarios.findUnique({
      where: { id_usuario: newUserId },
    });

    if (!newUser) {
      throw new NotFoundException('El usuario no existe');
    }

    // Verificar que ya no sea participante
    const alreadyParticipant = conversation.participantes.some(
      (p) => p.id_usuario === newUserId,
    );

    if (alreadyParticipant) {
      throw new ConflictException('El usuario ya es participante');
    }

    // Agregar participante
    const participant = await this.prisma.participantes.create({
      data: {
        id_conversacion: conversationId,
        id_usuario: newUserId,
      },
      include: {
        usuarios: {
          select: {
            id_usuario: true,
            nombre: true,
          },
        },
      },
    });

    return {
      id_usuario: participant.usuarios.id_usuario.toString(),
      nombre: participant.usuarios.nombre,
      fecha_union: participant.fecha_union,
    };
  }
}
