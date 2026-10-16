import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Uniform API error.
 *
 * Every failure the API returns has the shape:
 *   { statusCode, code, message, details? }
 *
 * `code` is a stable, machine-readable key that clients translate to
 * Persian/English copy (the web app maps it through its i18n catalogue, the
 * mobile app through its own resource bundles) — the `message` is an English
 * developer-facing fallback.
 */
export class ApiException extends HttpException {
  constructor(status: HttpStatus, code: string, message: string, details?: unknown) {
    const payload: Record<string, unknown> = { statusCode: status, code, message };
    if (details !== undefined) payload.details = details;
    super(payload, status);
  }

  static validation(details: unknown, message = 'Request validation failed'): ApiException {
    return new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', message, details);
  }

  static badRequest(code: string, message: string, details?: unknown): ApiException {
    return new ApiException(HttpStatus.BAD_REQUEST, code, message, details);
  }

  static unauthorized(code = 'UNAUTHORIZED', message = 'Authentication required'): ApiException {
    return new ApiException(HttpStatus.UNAUTHORIZED, code, message);
  }

  static forbidden(code = 'FORBIDDEN', message = 'Insufficient permissions'): ApiException {
    return new ApiException(HttpStatus.FORBIDDEN, code, message);
  }

  static notFound(code = 'NOT_FOUND', message = 'Resource not found'): ApiException {
    return new ApiException(HttpStatus.NOT_FOUND, code, message);
  }

  static conflict(code: string, message: string, details?: unknown): ApiException {
    return new ApiException(HttpStatus.CONFLICT, code, message, details);
  }
}
