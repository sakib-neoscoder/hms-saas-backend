import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Response } from 'express';

export interface StandardApiResponse<T> {
  success: boolean;
  statusCode: number;
  data: T;
  meta?: Record<string, unknown>;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, StandardApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<StandardApiResponse<T>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<Response>();
    const statusCode = response.statusCode;

    return next.handle().pipe(
      map((result) => {
        // Check if result already specifies custom meta
        if (
          result &&
          typeof result === 'object' &&
          'data' in result &&
          'meta' in result &&
          Object.keys(result).length === 2
        ) {
          return {
            success: true,
            statusCode,
            data: result.data,
            meta: result.meta,
          };
        }

        return {
          success: true,
          statusCode,
          data: result,
        };
      }),
    );
  }
}
