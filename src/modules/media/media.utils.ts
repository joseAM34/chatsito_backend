import { BadRequestException, UnauthorizedException } from '@nestjs/common';

export interface UsuarioAutenticado {
  id_usuario: string;
}

export function idDelUsuario(usuario: UsuarioAutenticado | undefined): bigint {
  const valor: unknown = usuario?.id_usuario;
  const texto =
    typeof valor === 'string' || typeof valor === 'number' ? String(valor) : '';
  if (!/^\d{1,18}$/.test(texto)) {
    throw new UnauthorizedException('Usuario no autenticado');
  }
  return BigInt(texto);
}

export function parseId(valor: string, descripcion: string): bigint {
  if (!/^\d{1,18}$/.test(valor)) {
    throw new BadRequestException(`${descripcion} no es válido`);
  }
  return BigInt(valor);
}

export function normalizarMime(mime: string): string {
  const indice = mime.indexOf(';');
  const base = indice === -1 ? mime : mime.slice(0, indice);
  return base.trim().toLowerCase();
}

export function nombreSeguro(original: string): string {
  const caracteres = Array.from(original);
  const todosLatin1 = caracteres.every((c) => (c.codePointAt(0) ?? 0) <= 255);
  const decodificado = todosLatin1
    ? Buffer.from(original, 'latin1').toString('utf8')
    : original;
  const limpio = Array.from(decodificado)
    .filter((c) => {
      const codigo = c.codePointAt(0) ?? 0;
      return codigo >= 32 && codigo !== 127;
    })
    .join('')
    .trim();
  return limpio === '' ? 'audio' : limpio.slice(0, 255);
}

export function esNoEncontrado(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  );
}
