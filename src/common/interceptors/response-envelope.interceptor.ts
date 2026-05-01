import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, map } from 'rxjs';

export interface PaginatedResult<T> {
  items: T[];
  meta: { page: number; pageSize: number; total: number };
}

const isPaginated = <T>(value: unknown): value is PaginatedResult<T> =>
  typeof value === 'object' &&
  value !== null &&
  'items' in value &&
  'meta' in value &&
  Array.isArray((value as PaginatedResult<T>).items);

const HTTP_STATUS_MESSAGES: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No Content',
};

function statusMessage(code: number): string {
  return HTTP_STATUS_MESSAGES[code] ?? 'Success';
}

@Injectable()
export class ResponseEnvelopeInterceptor<T> implements NestInterceptor<T, unknown> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request & { correlationId?: string }>();
    const res = http.getResponse<Response>();

    return next.handle().pipe(
      map((value) => {
        const statusCode = res.statusCode;
        const requestId = req.correlationId ?? (req.headers['x-correlation-id'] as string) ?? 'N/A';
        const timestamp = new Date().toISOString();
        const message = statusMessage(statusCode);

        if (value === undefined || value === null) {
          return { success: true, statusCode, message, data: null, timestamp, requestId };
        }

        if (isPaginated(value)) {
          return {
            success: true,
            statusCode,
            message,
            data: value.items,
            meta: value.meta,
            timestamp,
            requestId,
          };
        }

        return { success: true, statusCode, message, data: value, timestamp, requestId };
      }),
    );
  }
}