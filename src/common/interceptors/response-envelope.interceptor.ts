import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
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

@Injectable()
export class ResponseEnvelopeInterceptor<T> implements NestInterceptor<T, unknown> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<unknown> {
    return next.handle().pipe(
      map((value) => {
        if (value === undefined || value === null) {
          return { data: null };
        }
        if (isPaginated(value)) {
          return { data: value.items, meta: value.meta };
        }
        return { data: value };
      }),
    );
  }
}
