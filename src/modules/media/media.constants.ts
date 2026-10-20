export const TAMANO_MAXIMO_BYTES: number = 10 * 1024 * 1024;

export const EXTENSIONES_AUDIO: ReadonlyMap<string, string> = new Map<
  string,
  string
>([
  ['audio/mpeg', '.mp3'],
  ['audio/wav', '.wav'],
  ['audio/x-wav', '.wav'],
  ['audio/ogg', '.ogg'],
  ['audio/mp4', '.m4a'],
  ['audio/x-m4a', '.m4a'],
  ['audio/webm', '.webm'],
]);
