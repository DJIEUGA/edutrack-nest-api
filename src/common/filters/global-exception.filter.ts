import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
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
  success: false;
  statusCode: number;
  message: string;
  error: {
    code: string;
    details?: unknown;
  };
  timestamp: string;
  requestId: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { correlationId?: string }>();

    const requestId =
      req.correlationId ?? (req.headers['x-correlation-id'] as string) ?? 'N/A';
    const timestamp = new Date().toISOString();

    const { status, message, code, details } = this.toResponse(exception);

    if (status >= 500) {
      this.logger.error(
        { err: exception, status, requestId },
        exception instanceof Error ? exception.stack : 'Unknown error',
      );
    }

    const body: ApiErrorBody = {
      success: false,
      statusCode: status,
      message,
      error: { code, details },
      timestamp,
      requestId,
    };

    res.status(status).json(body);
  }

  private toResponse(exception: unknown): {
    status: number;
    message: string;
    code: string;
    details?: unknown;
  } {
    if (exception instanceof DomainError) {
      return {
        status: this.statusForDomainError(exception),
        message: exception.message,
        code: exception.code,
        details: exception.details,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const message =
        typeof res === 'string'
          ? res
          : Array.isArray((res as { message?: string[] }).message)
            ? (res as { message: string[] }).message.join('; ')
            : ((res as { message?: string }).message ?? exception.message);
      return { status, message, code: this.codeForStatus(status), details: typeof res === 'object' ? res : undefined };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
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