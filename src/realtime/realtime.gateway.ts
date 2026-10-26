import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { PrismaService } from '../database/prisma.service';

@WebSocketGateway({ cors: { origin: 'http://localhost:5173' }, transports: ['websocket'] })
export class RealtimeGateway implements OnGatewayInit {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  afterInit(server: Server) {
    server.use(async (socket, next) => {
      try {
        const token: unknown = socket.handshake.auth.token;
        if (typeof token !== 'string') throw new Error('Missing token');
        const payload = await new JwtService().verifyAsync<{ sub: string; exp: number }>(token, {
          secret: this.config.getOrThrow<string>('JWT_SECRET'),
        });
        if (!/^\d+$/.test(payload.sub) || !Number.isFinite(payload.exp)) throw new Error('Invalid token');
        const user = await this.prisma.usuarios.findUnique({ where: { id_usuario: BigInt(payload.sub) } });
        if (!user) throw new Error('Unknown user');
        await socket.join(`user:${payload.sub}`);
        // Expired sessions must not keep receiving private notifications.
        const timer = setTimeout(() => socket.disconnect(true), Math.max(0, payload.exp * 1000 - Date.now()));
        socket.once('disconnect', () => clearTimeout(timer));
        next();
      } catch {
        next(new Error('No autorizado'));
      }
    });
  }

  async changed(conversationId: string, kind: 'message' | 'read' | 'conversation') {
    try {
      const participants = await this.prisma.participantes.findMany({
        where: { id_conversacion: BigInt(conversationId) }, select: { id_usuario: true },
      });
      const rooms = participants.map(p => `user:${p.id_usuario}`);
      if (rooms.length) this.server.to(rooms).emit('chat:changed', { conversationId, kind });
    } catch {
      // A notification failure must not turn a committed write into an HTTP failure.
      this.logger.error('No se pudo notificar el cambio de conversación');
    }
  }
}
