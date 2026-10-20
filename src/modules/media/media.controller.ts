import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ForwardAudioDto } from './dto/forward-audio.dto';
import { SubirAudioDto } from './dto/subir-audio.dto';
import type { ArchivoSubido } from './interfaces/archivo-subido.interface';
import type { AudioMessageResponse } from './interfaces/audio-message-response.interface';
import { TAMANO_MAXIMO_BYTES } from './media.constants';
import { MediaService } from './media.service';
import { idDelUsuario, parseId } from './media.utils';
import type { UsuarioAutenticado } from './media.utils';

@Controller()
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('conversations/:id/audio')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: TAMANO_MAXIMO_BYTES, files: 1 },
    }),
  )
  subirAudio(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Param('id') id: string,
    @UploadedFile() archivo: ArchivoSubido | undefined,
    @Body() dto: SubirAudioDto,
  ): Promise<AudioMessageResponse> {
    return this.media.enviarAudio(
      idDelUsuario(usuario),
      parseId(id, 'El id de la conversación'),
      archivo,
      dto.duracion_segundos,
    );
  }

  @Get('media/messages/:id')
  obtenerAudio(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Param('id') id: string,
  ): Promise<StreamableFile> {
    return this.media.obtenerAudio(
      idDelUsuario(usuario),
      parseId(id, 'El id del mensaje'),
    );
  }

  @Post('media/messages/:id/forward')
  reenviarAudio(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Param('id') id: string,
    @Body() dto: ForwardAudioDto,
  ): Promise<AudioMessageResponse> {
    return this.media.reenviarAudio(
      idDelUsuario(usuario),
      parseId(id, 'El id del mensaje'),
      parseId(dto.id_conversacion, 'El id de la conversación'),
    );
  }
}
