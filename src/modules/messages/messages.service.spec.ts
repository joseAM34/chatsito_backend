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

  it('allows the author to delete just before five minutes', async () => {
    prisma.mensajes.findUnique.mockResolvedValue({ id_mensaje: 2n, id_conversacion: 3n,
      id_remitente: 1n, tipo: 'texto', eliminado_en: null, fecha_envio: new Date(now.getTime() - 299999) });
    await expect(service.deleteMessage('2', user)).resolves.toEqual({ id_mensaje: '2', id_conversacion: '3' });
    expect(prisma.mensajes.update).toHaveBeenCalledWith({ where: { id_mensaje: 2n },
      data: { eliminado_en: now, contenido: 'Este mensaje fue eliminado' } });
  });

  it('rejects deletion at five minutes', async () => {
    prisma.mensajes.findUnique.mockResolvedValue({ id_remitente: 1n, fecha_envio: new Date(now.getTime() - 300000) });
    await expect(service.deleteMessage('2', user)).rejects.toThrow('5 minutos');
    expect(prisma.mensajes.update).not.toHaveBeenCalled();
  });

  it('rejects deletion by another user', async () => {
    prisma.mensajes.findUnique.mockResolvedValue({ id_remitente: 9n, fecha_envio: now });
    await expect(service.deleteMessage('2', user)).rejects.toThrow('Solo el autor');
    expect(prisma.mensajes.update).not.toHaveBeenCalled();
  });

  it('rejects editing an already deleted message', async () => {
    prisma.mensajes.findUnique.mockResolvedValue({ id_remitente: 1n, eliminado_en: now, tipo: 'texto', fecha_envio: now });
    await expect(service.updateMessage('2', { contenido: 'Cambio' }, user)).rejects.toThrow('eliminado');
    expect(prisma.mensajes.update).not.toHaveBeenCalled();
  });

  it.each([10 * 60 * 1000, 11 * 60 * 1000])('rejects editing at or beyond the deadline (%i ms)', async age => {
    prisma.mensajes.findUnique.mockResolvedValue({ id_remitente: 1n, tipo: 'texto', fecha_envio: new Date(now.getTime() - age) });
    await expect(service.updateMessage('2', { contenido: 'Cambio' }, user)).rejects.toThrow('10 minutos');
    expect(prisma.mensajes.update).not.toHaveBeenCalled();
  });

  it('allows editing just before the deadline, even after an earlier edit', async () => {
    const message = { id_mensaje: 2n, id_conversacion: 3n, id_remitente: 1n,
      tipo: 'texto', fecha_envio: new Date(now.getTime() - 599999), editado_en: now,
      archivos: null, lecturas_mensajes: [], reenviado_de_id: null, contenido: 'Cambio' };
    prisma.mensajes.findUnique.mockResolvedValue(message);
    prisma.mensajes.update.mockResolvedValue(message);
    await expect(service.updateMessage('2', { contenido: 'Cambio' }, user)).resolves.toMatchObject({ contenido: 'Cambio' });
    expect(prisma.mensajes.update).toHaveBeenCalled();
  });
});
