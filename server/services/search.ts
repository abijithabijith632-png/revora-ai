import { BaseService } from "./base";
import { SearchRepository } from "@/server/repositories/search";

/**
 * Global search service — tenant-scoped, server-side aggregation across all
 * CRM entities. Never queries from the browser.
 */
export class SearchService extends BaseService {
  private readonly repo: SearchRepository;

  constructor(organizationId: string) {
    super();
    this.repo = new SearchRepository(organizationId);
  }

  async search(term: string, limit = 50) {
    return this.repo.search(term, limit);
  }
}
