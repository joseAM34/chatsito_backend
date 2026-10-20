import { Matches } from 'class-validator';

export class ForwardAudioDto {
  @Matches(/^\d+$/, { message: 'id_conversacion debe ser un número' })
  id_conversacion!: string;
}
