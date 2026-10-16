import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiException } from './api-exception';

/**
 * Normalizes every error leaving the API into the documented envelope:
 *   { statusCode, code, message, details? }
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Http');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof ApiException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const resolved =
        typeof body === 'string'
          ? { statusCode: status, code: httpStatusToCode(status), message: body }
          : {
              statusCode: status,
              code: (body as Record<string, unknown>).code ?? httpStatusToCode(status),
              message: (body as Record<string, unknown>).message ?? exception.message,
              ...(((body as Record<string, unknown>).error as string) !== undefined
                ? { details: { original: (body as Record<string, unknown>).error } }
                : {}),
            };
      response.status(status).json(resolved);
      return;
    }

    this.logger.error(
      `Unhandled error on ${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : String(exception),
    );
    response.status(500).json({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
  }
}

function httpStatusToCode(status: number): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 405:
      return 'METHOD_NOT_ALLOWED';
    case 409:
      return 'CONFLICT';
    case 429:
      return 'TOO_MANY_REQUESTS';
    default:
      return status >= 500 ? 'INTERNAL_ERROR' : 'ERROR';
  }
}
