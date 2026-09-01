import { Request } from 'express';

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  search: string;
  sortBy?: string;
  sortOrder: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
  };
}

export function parsePaginationParams(req: Request, defaultLimit = 20): PaginationParams {
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || defaultLimit));
  const skip = (page - 1) * limit;
  const search = ((req.query.search as string) || '').trim();
  const sortBy = req.query.sortBy as string | undefined;
  const sortOrder = (req.query.sortOrder as string)?.toLowerCase() === 'asc' ? 'asc' : 'desc';

  return {
    page,
    limit,
    skip,
    search,
    sortBy,
    sortOrder,
  };
}

export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / params.limit) || 1;

  return {
    data,
    meta: {
      total,
      page: params.page,
      limit: params.limit,
      totalPages,
      hasPrevPage: params.page > 1,
      hasNextPage: params.page < totalPages,
    },
  };
}
