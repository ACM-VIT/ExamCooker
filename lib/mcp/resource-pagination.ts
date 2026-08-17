export const MAX_PAGE_SIZE = 50;

export type DatabaseResourcePageRequest = {
  page: number;
  pageSize: number;
};

export function getDatabaseResourcePageRequests(
  offset: number,
  limit: number,
): DatabaseResourcePageRequest[] {
  const normalizedOffset = Math.max(0, Math.floor(offset));
  const normalizedLimit = Math.max(0, Math.floor(limit));
  if (normalizedLimit === 0) return [];

  const firstPage = Math.floor(normalizedOffset / MAX_PAGE_SIZE) + 1;
  const lastPage =
    Math.floor((normalizedOffset + normalizedLimit - 1) / MAX_PAGE_SIZE) + 1;

  return Array.from({ length: lastPage - firstPage + 1 }, (_, index) => ({
    page: firstPage + index,
    pageSize: MAX_PAGE_SIZE,
  }));
}
