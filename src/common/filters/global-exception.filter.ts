import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { DomainError } from '../errors/domain.errors';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<any>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_SERVER_ERROR';
    let details: any = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse() as any;
      message = res.message || exception.message;
      code = res.error || 'HTTP_ERROR';
      
      // Handle NestJS class-validator errors specifically for Section 22.2
      if (status === HttpStatus.UNPROCESSABLE_ENTITY || status === HttpStatus.BAD_REQUEST) {
        code = 'VALIDATION_ERROR';
        details = Array.isArray(res.message) 
          ? res.message.reduce((acc: any, cur: string) => {
              const [field] = cur.split(' ');
              acc[field] = cur;
              return acc;
            }, {})
          : res.message;
      }
    } else if (exception instanceof QueryFailedError) {
      // Handle database-level errors (e.g. Postgres constraints)
      status = HttpStatus.BAD_REQUEST;
      const driverError = (exception as any).driverError;
      
      if (driverError?.code === '23505') { // Unique constraint
        code = 'CONFLICT';
        message = 'A record with this information already exists.';
      } else if (driverError?.code === '23502') { // Not null constraint
        code = 'VALIDATION';
        message = 'A required field was missing from the request.';
      } else if (driverError?.code === '42703' || driverError?.code === '42P01') { // Undefined column or table
        code = 'SCHEMA_MISMATCH';
        message = 'The database schema is out of sync. Please run migrations.';
        this.logger.error(`Schema Error: ${exception.message}. Ensure migrations are up to date.`);
      } else if (driverError?.code === '42883') { // Undefined operator (Type mismatch)
        code = 'TYPE_MISMATCH';
        message = 'A data type mismatch occurred (e.g., comparing text to UUID).';
        this.logger.error(`Type Mismatch Error [42883]: ${exception.message}. Check entity vs database column types.`);
      } else {
        code = 'DATABASE_ERROR';
        message = 'A database error occurred during the request.';
        this.logger.error(`Database Error [${driverError?.code}]: ${exception.message}`);
      }
    } else if (exception instanceof DomainError) {
      status = HttpStatus.BAD_REQUEST;
      message = exception.message;
      code = exception.code;
      details = exception.details as any;
      // Domain errors are expected business logic failures; log as warning
      this.logger.warn(`Domain Error [${code}]: ${message}`);
    } else {
      this.logger.error(`Unhandled Exception: ${exception.message}`, exception.stack);
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message: Array.isArray(message) ? message[0] : message,
      error: {
        code,
        details,
      },
      timestamp: new Date().toISOString(),
      requestId: request.correlationId || request.headers['x-request-id'] || 'req_unknown',
    });
  }
}