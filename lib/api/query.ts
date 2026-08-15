import { ZodSchema } from "zod";
import { ValidationError } from "@/lib/errors";

/**
 * Query parameter parsing — pagination, sort (allowlist), search, and filters.
 * Server-authoritative; never trust raw client input for SQL ordering.
 */

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface Pagination {
  page: number;
  pageSize: number;
  offset: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function parsePagination(url: URL): Pagination {
  const rawPage = url.searchParams.get("page");
  const rawSize = url.searchParams.get("pageSize");

  const page = rawPage ? Number(rawPage) : 1;
  const pageSize = rawSize ? Number(rawSize) : DEFAULT_PAGE_SIZE;

  if (!Number.isInteger(page) || page < 1) {
    throw new ValidationError("Page must be a positive integer.", {
      page: "Page must be a positive integer.",
    });
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw new ValidationError(`Page size must be between 1 and ${MAX_PAGE_SIZE}.`, {
      pageSize: `Page size must be between 1 and ${MAX_PAGE_SIZE}.`,
    });
  }

  return { page, pageSize, offset: (page - 1) * pageSize };
}

export interface Sort<T extends string> {
  column: T;
  order: "asc" | "desc";
}

/**
 * Parse a sort allowlist-safe order. Only `allowlist` columns are permitted.
 */
export function parseSort<T extends string>(
  url: URL,
  allowlist: readonly T[],
  defaultColumn: T,
  defaultOrder: "asc" | "desc" = "desc",
): Sort<T> {
  const sortBy = url.searchParams.get("sortBy");
  const sortOrder = url.searchParams.get("sortOrder");

  const column = (sortBy && allowlist.includes(sortBy as T))
    ? (sortBy as T)
    : defaultColumn;

  const order = sortOrder === "asc" || sortOrder === "desc" ? sortOrder : defaultOrder;

  return { column, order };
}

export function parseSearch(url: URL): string {
  const raw = url.searchParams.get("search") ?? "";
  return raw.trim().slice(0, 200);
}

/**
 * Parse and validate arbitrary filter query params using a Zod schema.
 * Only keys declared in the schema are allowed.
 */
export function parseFilters<T extends Record<string, unknown>>(
  url: URL,
  schema: ZodSchema<T>,
  allowedKeys: readonly string[],
): T {
  const filters: Record<string, unknown> = {};
  for (const key of allowedKeys) {
    const value = url.searchParams.get(key);
    if (value !== null && value !== "") {
      filters[key] = value;
    }
  }
  const result = schema.safeParse(filters);
  if (!result.success) {
    throw new ValidationError(
      "Invalid filter parameters.",
      result.error.flatten().fieldErrors,
    );
  }
  return result.data;
}

export function buildPaginationMeta(
  total: number,
  pagination: Pagination,
): PaginationMeta {
  return {
    page: pagination.page,
    pageSize: pagination.pageSize,
    total,
    totalPages: Math.ceil(total / pagination.pageSize),
  };
}
