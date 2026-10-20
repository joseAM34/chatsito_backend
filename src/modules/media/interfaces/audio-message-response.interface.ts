export interface ArchivoRespuesta {
  id_archivo: string;
  nombre: string;
  formato: string;
  tamano_bytes: number;
  duracion_segundos: number | null;
}

export interface AudioMessageResponse {
  id_mensaje: string;
  id_conversacion: string;
  id_remitente: string;
  contenido: null;
  tipo: 'audio';
  fecha_envio: string;
  editado_en: string | null;
  reenviado_de_id: string | null;
  remitente: {
    id_usuario: string;
    nombre: string;
  };
  leido_por: string[];
  archivo: ArchivoRespuesta;
}
