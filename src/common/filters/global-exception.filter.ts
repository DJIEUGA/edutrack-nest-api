import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  InvalidStateTransitionError,
  NotFoundError,
  SchedulingConflictError,
  TenantScopeError,
  UnauthorizedError,
  ValidationError,
} from '../errors/domain.errors';

interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const { status, body } = this.toResponse(exception);

    if (status >= 500) {
      this.logger.error(
        { err: exception, status },
        exception instanceof Error ? exception.stack : 'Unknown error',
      );
    }

    response.status(status).json(body);
  }

  private toResponse(exception: unknown): { status: number; body: ApiErrorBody } {
    if (exception instanceof DomainError) {
      const status = this.statusForDomainError(exception);
      return {
        status,
        body: { error: { code: exception.code, message: exception.message, details: exception.details } },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const message =
        typeof res === 'string'
          ? res
          : (res as { message?: string | string[] }).message
            ? Array.isArray((res as { message: string[] }).message)
              ? (res as { message: string[] }).message.join('; ')
              : ((res as { message: string }).message as string)
            : exception.message;
      const details = typeof res === 'object' ? res : undefined;
      return {
        status,
        body: { error: { code: this.codeForStatus(status), message, details } },
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
    };
  }

  private statusForDomainError(error: DomainError): number {
    if (error instanceof NotFoundError) return HttpStatus.NOT_FOUND;
    if (error instanceof UnauthorizedError) return HttpStatus.UNAUTHORIZED;
    if (error instanceof ForbiddenError || error instanceof TenantScopeError)
      return HttpStatus.FORBIDDEN;
    if (
      error instanceof ConflictError ||
      error instanceof SchedulingConflictError ||
      error instanceof InvalidStateTransitionError
    )
      return HttpStatus.CONFLICT;
    if (error instanceof ValidationError) return HttpStatus.BAD_REQUEST;
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private codeForStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'UNPROCESSABLE_ENTITY';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMITED';
      default:
        return status >= 500 ? 'INTERNAL_ERROR' : 'ERROR';
    }
  }
}
