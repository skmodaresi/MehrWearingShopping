import { BadRequestException } from '@nestjs/common';

export interface PageParams {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

/**
 * Shared list-query pagination.
 * `page` is 1-based; `limit` is clamped to 100 to keep responses bounded.
 */
export function parsePagination(query: { page?: unknown; limit?: unknown }): PageParams {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

export function paged<T>(items: T[], total: number, params: PageParams): Paged<T> {
  return {
    items,
    total,
    page: params.page,
    pages: Math.max(1, Math.ceil(total / params.limit)),
    limit: params.limit,
  };
}

export function assertPositiveInt(value: unknown, field: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new BadRequestException(`${field} must be a positive integer`);
  }
  return parsed;
}
