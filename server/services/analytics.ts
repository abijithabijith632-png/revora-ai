import { BaseService } from "./base";
import { AnalyticsRepository } from "@/server/repositories/analytics";

/**
 * Executive analytics — dashboard KPIs, funnel, source attribution, pipeline
 * distribution, and salesperson performance. Role scope is enforced by the
 * caller (Sales Executive sees own data only via `ownerId`).
 */
export class AnalyticsService extends BaseService {
  private readonly repo: AnalyticsRepository;

  constructor(organizationId: string) {
    super();
    this.repo = new AnalyticsRepository(organizationId);
  }

  async dashboard() {
    return this.repo.dashboard();
  }

  async leadsOverTime(days?: number) {
    return this.repo.leadsOverTime(days ?? 30);
  }

  async funnel() {
    return this.repo.funnel();
  }

  async sourceAttribution() {
    return this.repo.sourceAttribution();
  }

  async pipelineByStage() {
    return this.repo.pipelineByStage();
  }

  async performance(ownerId?: string) {
    return this.repo.salespersonPerformance(ownerId);
  }
}
