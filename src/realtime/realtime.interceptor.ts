import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request } from 'express';
import { mergeMap } from 'rxjs';
import { RealtimeGateway } from './realtime.gateway';

@Injectable()
export class RealtimeInterceptor implements NestInterceptor {
  constructor(private readonly realtime: RealtimeGateway) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    if (context.getType() !== 'http') return next.handle();
    const request = context.switchToHttp().getRequest<Request>();
    const path = request.path;
    if (!['POST', 'PATCH', 'DELETE'].includes(request.method) ||
        !/^\/api\/(conversations|messages|media\/messages)(\/|$)/.test(path)) return next.handle();
    return next.handle().pipe(mergeMap(async (result: unknown) => {
      const data = result as { id_conversacion?: string | bigint; id_mensaje?: string | bigint; id_remitente?: string | bigint; marcados?: number } | null;
      const id = data?.id_conversacion?.toString() ?? /^\/api\/conversations\/(\d+)/.exec(path)?.[1];
      if (id && /^\d+$/.test(id) && data?.marcados !== 0) {
        const kind = path.endsWith('/read') ? 'read' : /messages|audio/.test(path) ? 'message' : 'conversation';
        if (request.method === 'POST' && data?.id_mensaje != null && data.id_remitente != null) {
          await this.realtime.changed(id, kind, {
            messageId: data.id_mensaje.toString(), senderId: data.id_remitente.toString(),
          });
        } else {
          await this.realtime.changed(id, kind);
        }
      }
      return result;
    }));
  }
}
