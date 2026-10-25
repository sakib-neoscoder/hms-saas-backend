import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: unknown = null;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const respObj = exceptionResponse as Record<string, unknown>;
        message = (respObj.message as string) || exception.message;
        if (Array.isArray(respObj.message)) {
          message = 'Validation failed';
          errors = respObj.message;
        } else if (respObj.errors) {
          errors = respObj.errors;
        }
      }
    } else if ((exception as any)?.code === '23505') {
      // Gracefully handle PostgreSQL unique constraint violation
      statusCode = HttpStatus.CONFLICT;
      message = 'A record with this unique identifier already exists';
      this.logger.warn(
        `PostgreSQL Unique Violation [23505]: ${(exception as Error).message}`,
        `${request.method} ${request.url}`,
      );
    } else if (exception instanceof Error) {
      this.logger.error(
        `Unhandled Exception: ${exception.message}`,
        exception.stack,
        `${request.method} ${request.url}`,
      );

      // Prevent internal error message leakage in production
      const isProduction = process.env.NODE_ENV === 'production';
      message = isProduction ? 'Internal server error' : exception.message;
    } else {
      this.logger.error('Unknown exception caught', JSON.stringify(exception));
    }

    const errorPayload = {
      success: false,
      statusCode,
      message,
      ...(errors ? { errors } : {}),
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(statusCode).json(errorPayload);
  }
}
