import type { AudioMessageResponse } from './interfaces/audio-message-response.interface';

export interface FilaMensaje {
  id_mensaje: bigint;
  id_conversacion: bigint;
  id_remitente: bigint;
  fecha_envio: Date;
  editado_en: Date | null;
  reenviado_de_id: bigint | null;
}

export interface FilaArchivo {
  id_archivo: bigint;
  nombre: string;
  formato: string;
  tamano_bytes: bigint;
  duracion_segundos: number | null;
}

export interface FilaRemitente {
  id_usuario: bigint;
  nombre: string;
}

export function construirRespuesta(
  mensaje: FilaMensaje,
  archivo: FilaArchivo,
  remitente: FilaRemitente,
): AudioMessageResponse {
  return {
    id_mensaje: mensaje.id_mensaje.toString(),
    id_conversacion: mensaje.id_conversacion.toString(),
    id_remitente: mensaje.id_remitente.toString(),
    contenido: null,
    tipo: 'audio',
    fecha_envio: mensaje.fecha_envio.toISOString(),
    editado_en:
      mensaje.editado_en === null ? null : mensaje.editado_en.toISOString(),
    reenviado_de_id:
      mensaje.reenviado_de_id === null
        ? null
        : mensaje.reenviado_de_id.toString(),
    remitente: {
      id_usuario: remitente.id_usuario.toString(),
      nombre: remitente.nombre,
    },
    leido_por: [],
    archivo: {
      id_archivo: archivo.id_archivo.toString(),
      nombre: archivo.nombre,
      formato: archivo.formato,
      tamano_bytes: Number(archivo.tamano_bytes),
      duracion_segundos: archivo.duracion_segundos,
    },
  };
}
