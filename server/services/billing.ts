import { BaseService } from "./base";
import { BillingRepository } from "@/server/repositories/billing";
import { OrganizationRepository } from "@/server/repositories/organizations";
import { paymentProvider } from "@/server/billing/provider";
import { recordAudit } from "@/lib/api/audit";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import {
  getPlan,
  isUpgrade,
  isDowngrade,
  type PlanKey,
} from "@/lib/billing";

/**
 * Billing service (Phase 16).
 * Plans/subscription/invoices/payments with honest payment provider abstraction.
 */
export class BillingService extends BaseService {
  private readonly repo: BillingRepository;
  private readonly org: OrganizationRepository;

  constructor(organizationId: string) {
    super();
    this.repo = new BillingRepository(organizationId);
    this.org = new OrganizationRepository(organizationId);
  }

  async overview() {
    const [plans, subscription, usage] = await Promise.all([
      this.repo.listPlans(),
      this.repo.subscription(),
      this.org.usage(),
    ]);

    const currentPlan = subscription?.plan?.name
      ? getPlan(subscription.plan.name as PlanKey)
      : getPlan("FREE");

    return {
      plans,
      subscription: subscription?.subscription ?? null,
      currentPlan,
      usage,
      paymentProviderConfigured: paymentProvider.isConfigured(),
      paymentProviderName: process.env.PAYMENT_PROVIDER ?? "",
    };
  }

  async changePlan(
    actor: { userId: string },
    planName: PlanKey,
  ) {
    const plan = getPlan(planName);
    const existing = await this.repo.getSubscription();
    const currentKey = existing?.planId
      ? (await this.findPlanKeyById(existing.planId)) ?? "FREE"
      : "FREE";

    if (planName === currentKey) {
      throw new ConflictError("You are already on this plan.");
    }

    // Enforce payment provider for paid upgrades.
    if (plan.priceMonthly != null && !paymentProvider.isConfigured()) {
      throw new ForbiddenError(
        "Payment integration is not configured. Set PAYMENT_PROVIDER_API_KEY to enable paid plan changes.",
      );
    }

    const planRow = await this.repo.getPlanByName(plan.name);
    if (!planRow) throw new NotFoundError("Plan not found in catalog.");

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sub = await this.repo.upsertSubscription({
      planId: planRow.id,
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    });

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "update",
      entityType: "subscription",
      entityId: sub.id,
      metadata: {
        from: currentKey,
        to: planName,
        upgrade: isUpgrade(currentKey as PlanKey, planName),
        downgrade: isDowngrade(currentKey as PlanKey, planName),
      },
    });

    return sub;
  }

  async cancel(actor: { userId: string }) {
    const existing = await this.repo.getSubscription();
    if (!existing) throw new NotFoundError("No active subscription.");
    const sub = await this.repo.upsertSubscription({
      planId: existing.planId,
      status: "cancelled",
    });
    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "update",
      entityType: "subscription",
      entityId: sub.id,
      metadata: { cancelled: true },
    });
    return sub;
  }

  async listInvoices() {
    return this.repo.listInvoices();
  }

  async listPayments() {
    return this.repo.listPayments();
  }

  /** Generate an invoice (record) for the current subscription. */
  async generateInvoice(actor: { userId: string }) {
    const subscription = await this.repo.getSubscription();
    const plan = subscription?.planId
      ? await this.findPlanById(subscription.planId)
      : null;
    const amount = plan?.priceMonthly ?? 0;
    const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;

    const invoice = await this.repo.createInvoice({
      subscriptionId: subscription?.id ?? null,
      invoiceNumber,
      amount,
      currency: "INR",
      status: "issued",
      description: plan ? `${plan.name} subscription` : "Subscription",
    });

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "create",
      entityType: "invoice",
      entityId: invoice.id,
      metadata: { invoiceNumber, amount },
    });
    return invoice;
  }

  private async findPlanById(planId: string) {
    const plans = await this.repo.listPlans();
    return plans.find((p) => p.id === planId) ?? null;
  }

  private async findPlanKeyById(planId: string): Promise<PlanKey | null> {
    const plan = await this.findPlanById(planId);
    return (plan?.name as PlanKey) ?? null;
  }
}
