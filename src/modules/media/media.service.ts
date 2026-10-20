import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  StreamableFile,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { PrismaService } from '../../database/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import type { ArchivoSubido } from './interfaces/archivo-subido.interface';
import type { AudioMessageResponse } from './interfaces/audio-message-response.interface';
import { EXTENSIONES_AUDIO } from './media.constants';
import { construirRespuesta } from './media.mapper';
import { esNoEncontrado, nombreSeguro, normalizarMime } from './media.utils';

interface DatosAudio {
  idConversacion: bigint;
  idRemitente: bigint;
  reenviadoDeId: bigint | null;
  nombre: string;
  formato: string;
  tamanoBytes: bigint;
  duracionSegundos: number | null;
  objectKey: string;
}

interface AudioAccesible {
  idConversacion: bigint;
  archivo: {
    id_archivo: bigint;
    nombre: string;
    formato: string;
    tamano_bytes: bigint;
    duracion_segundos: number | null;
    object_key: string;
  };
}

@Injectable()
export class MediaService implements OnModuleInit {
  private readonly logger = new Logger(MediaService.name);
  private readonly directorioBase: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.directorioBase = resolve(
      process.cwd(),
      this.config.get<string>('UPLOADS_DIR') ?? 'uploads',
    );
  }

  async onModuleInit(): Promise<void> {
    await mkdir(resolve(this.directorioBase, 'audios'), { recursive: true });
  }

  async enviarAudio(
    idUsuario: bigint,
    idConversacion: bigint,
    archivo: ArchivoSubido | undefined,
    duracionSegundos: number | undefined,
  ): Promise<AudioMessageResponse> {
    if (archivo === undefined) {
      throw new BadRequestException('Falta el archivo de audio (campo "file")');
    }

    const formato = normalizarMime(archivo.mimetype);
    const extension = EXTENSIONES_AUDIO.get(formato);
    if (extension === undefined) {
      throw new UnsupportedMediaTypeException(
        'Formato no permitido. Usa mp3, wav, ogg, m4a o webm',
      );
    }
    if (archivo.size <= 0) {
      throw new BadRequestException('El archivo está vacío');
    }

    await this.exigirParticipante(idConversacion, idUsuario);

    const objectKey = `audios/${randomUUID()}${extension}`;
    const rutaFisica = this.rutaDe(objectKey);
    await mkdir(dirname(rutaFisica), { recursive: true });
    await writeFile(rutaFisica, archivo.buffer);

    const datos: DatosAudio = {
      idConversacion,
      idRemitente: idUsuario,
      reenviadoDeId: null,
      nombre: nombreSeguro(archivo.originalname),
      formato,
      tamanoBytes: BigInt(archivo.size),
      duracionSegundos: duracionSegundos ?? null,
      objectKey,
    };

    try {
      return await this.prisma.$transaction((tx) =>
        this.crearMensajeAudio(tx, datos),
      );
    } catch (error: unknown) {
      await this.borrarSilencioso(rutaFisica);
      throw error;
    }
  }

  async obtenerAudio(
    idUsuario: bigint,
    idMensaje: bigint,
  ): Promise<StreamableFile> {
    const { archivo } = await this.buscarAudioAccesible(idUsuario, idMensaje);
    const rutaFisica = this.rutaDe(archivo.object_key);

    let tamano: number;
    try {
      tamano = (await stat(rutaFisica)).size;
    } catch (error: unknown) {
      if (esNoEncontrado(error)) {
        throw new NotFoundException('El archivo de audio no está disponible');
      }
      throw error;
    }

    return new StreamableFile(createReadStream(rutaFisica), {
      type: archivo.formato,
      length: tamano,
      disposition: 'inline',
    });
  }

  async reenviarAudio(
    idUsuario: bigint,
    idMensaje: bigint,
    idConversacionDestino: bigint,
  ): Promise<AudioMessageResponse> {
    const { archivo } = await this.buscarAudioAccesible(idUsuario, idMensaje);
    await this.exigirParticipante(idConversacionDestino, idUsuario);

    const rutaOrigen = this.rutaDe(archivo.object_key);
    const objectKeyNuevo = `audios/${randomUUID()}${extname(archivo.object_key)}`;
    const rutaNueva = this.rutaDe(objectKeyNuevo);

    await mkdir(dirname(rutaNueva), { recursive: true });
    try {
      await copyFile(rutaOrigen, rutaNueva);
    } catch (error: unknown) {
      if (esNoEncontrado(error)) {
        throw new NotFoundException('El archivo original no está disponible');
      }
      throw error;
    }

    const datos: DatosAudio = {
      idConversacion: idConversacionDestino,
      idRemitente: idUsuario,
      reenviadoDeId: idMensaje,
      nombre: archivo.nombre,
      formato: archivo.formato,
      tamanoBytes: archivo.tamano_bytes,
      duracionSegundos: archivo.duracion_segundos,
      objectKey: objectKeyNuevo,
    };

    try {
      return await this.prisma.$transaction((tx) =>
        this.crearMensajeAudio(tx, datos),
      );
    } catch (error: unknown) {
      await this.borrarSilencioso(rutaNueva);
      throw error;
    }
  }

  private async crearMensajeAudio(
    tx: Prisma.TransactionClient,
    datos: DatosAudio,
  ): Promise<AudioMessageResponse> {
    const mensaje = await tx.mensajes.create({
      data: {
        id_conversacion: datos.idConversacion,
        id_remitente: datos.idRemitente,
        tipo: 'audio',
        contenido: null,
        reenviado_de_id: datos.reenviadoDeId,
      },
    });

    const archivo = await tx.archivos.create({
      data: {
        id_mensaje: mensaje.id_mensaje,
        nombre: datos.nombre,
        formato: datos.formato,
        tamano_bytes: datos.tamanoBytes,
        duracion_segundos: datos.duracionSegundos,
        object_key: datos.objectKey,
      },
    });

    const remitente = await tx.usuarios.findUnique({
      where: { id_usuario: datos.idRemitente },
      select: { id_usuario: true, nombre: true },
    });
    if (remitente === null) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return construirRespuesta(mensaje, archivo, remitente);
  }

  private async buscarAudioAccesible(
    idUsuario: bigint,
    idMensaje: bigint,
  ): Promise<AudioAccesible> {
    const archivo = await this.prisma.archivos.findUnique({
      where: { id_mensaje: idMensaje },
      select: {
        id_archivo: true,
        nombre: true,
        formato: true,
        tamano_bytes: true,
        duracion_segundos: true,
        object_key: true,
      },
    });
    if (archivo === null) {
      throw new NotFoundException('Audio no encontrado');
    }

    const mensaje = await this.prisma.mensajes.findUnique({
      where: { id_mensaje: idMensaje },
      select: { id_conversacion: true },
    });
    if (mensaje === null) {
      throw new NotFoundException('Audio no encontrado');
    }

    await this.exigirParticipante(mensaje.id_conversacion, idUsuario);
    return { archivo, idConversacion: mensaje.id_conversacion };
  }

  private async exigirParticipante(
    idConversacion: bigint,
    idUsuario: bigint,
  ): Promise<void> {
    const fila = await this.prisma.participantes.findFirst({
      where: { id_conversacion: idConversacion, id_usuario: idUsuario },
      select: { id_usuario: true },
    });
    if (fila === null) {
      throw new NotFoundException('Conversación no encontrada');
    }
  }

  private rutaDe(objectKey: string): string {
    const ruta = resolve(this.directorioBase, objectKey);
    const relativa = relative(this.directorioBase, ruta);
    if (relativa === '' || relativa.startsWith('..') || isAbsolute(relativa)) {
      throw new NotFoundException('Archivo no disponible');
    }
    return ruta;
  }

  private async borrarSilencioso(ruta: string): Promise<void> {
    try {
      await unlink(ruta);
    } catch (error: unknown) {
      if (!esNoEncontrado(error)) {
        this.logger.warn(`No se pudo borrar el archivo ${ruta}`);
      }
    }
  }
}
