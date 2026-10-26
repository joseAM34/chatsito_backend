import { MessagesService } from './messages.service';
import { PrismaService } from '../../database/prisma.service';

describe('Message editing deadline', () => {
  const now = new Date('2026-10-25T12:00:00Z');
  const user = { id_usuario: '1', nombre: 'Test', correo: 'test@example.com' };
  const prisma = { mensajes: { findUnique: jest.fn(), update: jest.fn() }, usuarios: { findUnique: jest.fn() } };
  const service = new MessagesService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(now);
    prisma.usuarios.findUnique.mockResolvedValue({ id_usuario: 1n, nombre: 'Test' });
  });
  afterEach(() => jest.useRealTimers());

  it.each([15 * 60 * 1000, 16 * 60 * 1000])('rejects editing at or beyond the deadline (%i ms)', async age => {
    prisma.mensajes.findUnique.mockResolvedValue({ id_remitente: 1n, tipo: 'texto', fecha_envio: new Date(now.getTime() - age) });
    await expect(service.updateMessage('2', { contenido: 'Cambio' }, user)).rejects.toThrow('15 minutos');
    expect(prisma.mensajes.update).not.toHaveBeenCalled();
  });

  it('allows editing just before the deadline, even after an earlier edit', async () => {
    const message = { id_mensaje: 2n, id_conversacion: 3n, id_remitente: 1n,
      tipo: 'texto', fecha_envio: new Date(now.getTime() - 899999), editado_en: now,
      archivos: null, lecturas_mensajes: [], reenviado_de_id: null, contenido: 'Cambio' };
    prisma.mensajes.findUnique.mockResolvedValue(message);
    prisma.mensajes.update.mockResolvedValue(message);
    await expect(service.updateMessage('2', { contenido: 'Cambio' }, user)).resolves.toMatchObject({ contenido: 'Cambio' });
    expect(prisma.mensajes.update).toHaveBeenCalled();
  });
});
