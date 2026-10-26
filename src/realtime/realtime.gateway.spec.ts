import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Server } from 'socket.io';
import { PrismaService } from '../database/prisma.service';
import { RealtimeGateway } from './realtime.gateway';

describe('RealtimeGateway authorization', () => {
  const prisma = { usuarios: { findUnique: jest.fn() }, participantes: { findMany: jest.fn() } };
  let gateway: RealtimeGateway;
  let middleware: (socket: any, next: (error?: Error) => void) => Promise<void>;
  const emit = jest.fn();
  const to = jest.fn(() => ({ emit }));

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = new RealtimeGateway(prisma as unknown as PrismaService,
      { getOrThrow: () => 'test-secret' } as unknown as ConfigService);
    const server = { use: (fn: typeof middleware) => { middleware = fn; }, to } as unknown as Server;
    gateway.server = server;
    gateway.afterInit(server);
  });

  it('rejects connections without a token', async () => {
    const next = jest.fn();
    await middleware({ handshake: { auth: {} } }, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(prisma.usuarios.findUnique).not.toHaveBeenCalled();
  });

  it('rejects forged tokens', async () => {
    const next = jest.fn();
    const token = new JwtService().sign({ sub: '7' }, { secret: 'wrong-secret' });
    await middleware({ handshake: { auth: { token } } }, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('joins only the authenticated user room', async () => {
    prisma.usuarios.findUnique.mockResolvedValue({ id_usuario: 7n });
    const token = new JwtService().sign({ sub: '7' }, { secret: 'test-secret', expiresIn: '1h' });
    let cleanup: () => void = () => {};
    const socket = { handshake: { auth: { token } }, join: jest.fn(),
      once: (_event: string, fn: () => void) => { cleanup = fn; }, disconnect: jest.fn() };
    const next = jest.fn();
    await middleware(socket, next);
    cleanup();
    expect(socket.join).toHaveBeenCalledWith('user:7');
    expect(next).toHaveBeenCalledWith();
  });

  it('notifies only participants of the changed conversation', async () => {
    prisma.participantes.findMany.mockResolvedValue([{ id_usuario: 7n }, { id_usuario: 9n }]);
    await gateway.changed('12', 'message');
    expect(prisma.participantes.findMany).toHaveBeenCalledWith({
      where: { id_conversacion: 12n }, select: { id_usuario: true },
    });
    expect(to).toHaveBeenCalledWith(['user:7', 'user:9']);
    expect(emit).toHaveBeenCalledWith('chat:changed', { conversationId: '12', kind: 'message' });
  });
});
