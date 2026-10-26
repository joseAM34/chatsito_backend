import { ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeInterceptor } from './realtime.interceptor';

describe('Realtime HTTP notifications', () => {
  const changed = jest.fn().mockResolvedValue(undefined);
  const interceptor = new RealtimeInterceptor({ changed } as unknown as RealtimeGateway);
  const context = (method: string, path: string) => ({
    getType: () => 'http', switchToHttp: () => ({ getRequest: () => ({ method, path }) }),
  }) as unknown as ExecutionContext;

  beforeEach(() => jest.clearAllMocks());

  it('emits after a successful message write', async () => {
    const result = { id_conversacion: '12', id_mensaje: '90' };
    const response = await lastValueFrom(interceptor.intercept(context('POST', '/api/conversations/12/messages'),
      { handle: () => of(result) }));
    expect(response).toBe(result);
    expect(changed).toHaveBeenCalledWith('12', 'message');
  });

  it('does not emit for GET or unchanged read receipts', async () => {
    await lastValueFrom(interceptor.intercept(context('GET', '/api/conversations'), { handle: () => of([]) }));
    await lastValueFrom(interceptor.intercept(context('POST', '/api/conversations/12/messages/read'),
      { handle: () => of({ marcados: 0 }) }));
    expect(changed).not.toHaveBeenCalled();
  });

  it('does not notify failed writes', async () => {
    await expect(lastValueFrom(interceptor.intercept(context('POST', '/api/conversations/12/messages'),
      { handle: () => throwError(() => new Error('Forbidden')) }))).rejects.toThrow('Forbidden');
    expect(changed).not.toHaveBeenCalled();
  });

  it('notifies the destination conversation for forwarded audio', async () => {
    await lastValueFrom(interceptor.intercept(context('POST', '/api/media/messages/90/forward'),
      { handle: () => of({ id_conversacion: '15' }) }));
    expect(changed).toHaveBeenCalledWith('15', 'message');
  });
});
