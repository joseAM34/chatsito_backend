export interface MessageResponse {
  id_mensaje: string;
  id_conversacion: string;
  id_remitente: string;
  contenido: string | null;
  tipo: string;
  fecha_envio: Date;
  editado_en: Date | null;
  reenviado_de_id: string | null;
  remitente: {
    id_usuario: string;
    nombre: string;
  };
  leido_por: string[];
}
