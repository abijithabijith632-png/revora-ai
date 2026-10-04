import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions/authorize";
import { BillingService } from "@/server/services/billing";
import { subscriptionStatusLabel } from "@/lib/billing";
import { formatMoney } from "@/lib/money";
import { PageHeader, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from "@/components/ui";
import { BillingManager } from "@/components/admin/billing-manager";

export const metadata = { title: "Billing & Plan" };

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-faint">{label}</p>
      <p className="text-sm text-foreground">{value || "—"}</p>
    </div>
  );
}

export default async function BillingPage() {
  const session = await requireSession();
  const allowed = await userHasPermission(session.userId, session.organizationId, "billing.view");
  if (!allowed) redirect("/forbidden");

  const service = new BillingService(session.organizationId);
  const [overview, invoices, payments] = await Promise.all([
    service.overview(),
    service.listInvoices(),
    service.listPayments(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing & Plan"
        description="Current plan, subscription state, usage, and payment configuration."
      />

      <BillingManager
        plans={overview.plans.map((p) => ({
          name: p.name,
          description: p.description,
          priceMonthly: p.priceMonthly,
          limits: {
            userSeats: (p.limits as { userSeats: number })?.userSeats ?? 0,
            leadStorage: (p.limits as { leadStorage: number | null })?.leadStorage ?? null,
            aiUsage: (p.limits as { aiUsage: number | null })?.aiUsage ?? null,
            advancedReports: Boolean((p.limits as { advancedReports: boolean })?.advancedReports),
            integrations: Boolean((p.limits as { integrations: boolean })?.integrations),
            customConfiguration: Boolean(
              (p.limits as { customConfiguration: boolean })?.customConfiguration,
            ),
          },
        }))}
        currentPlanName={overview.currentPlan.name.toUpperCase()}
        subscriptionStatus={overview.subscription?.status ?? null}
        paymentConfigured={overview.paymentProviderConfigured}
        paymentName={overview.paymentProviderName}
        usage={overview.usage}
        limits={{
          userSeats: overview.currentPlan.limits.userSeats,
          leadStorage: overview.currentPlan.limits.leadStorage,
          aiUsage: overview.currentPlan.limits.aiUsage,
          advancedReports: overview.currentPlan.limits.advancedReports,
          integrations: overview.currentPlan.limits.integrations,
          customConfiguration: overview.currentPlan.limits.customConfiguration,
        }}
        invoices={invoices.map((i) => ({
          id: i.id,
          invoiceNumber: i.invoiceNumber,
          amount: i.amount,
          currency: i.currency,
          status: i.status,
          description: i.description,
          issuedAt: i.issuedAt.toISOString(),
        }))}
        payments={payments.map((p) => ({
          id: p.id,
          provider: p.provider,
          providerReference: p.providerReference,
          amount: p.amount,
          currency: p.currency,
          status: p.status,
          createdAt: p.createdAt.toISOString(),
        }))}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Current Plan
              <Badge variant="ai">{overview.currentPlan.name}</Badge>
            </CardTitle>
            <CardDescription>{overview.currentPlan.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field
              label="Monthly price"
              value={overview.currentPlan.priceMonthly == null ? "Free" : formatMoney(overview.currentPlan.priceMonthly, "INR")}
            />
            <Field
              label="Subscription status"
              value={overview.subscription ? subscriptionStatusLabel(overview.subscription.status) : "No subscription"}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plan Limits</CardTitle>
            <CardDescription>Server-enforced entitlements.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Field label="User seats" value={String(overview.currentPlan.limits.userSeats)} />
            <Field label="Lead storage" value={overview.currentPlan.limits.leadStorage == null ? "Unlimited" : String(overview.currentPlan.limits.leadStorage)} />
            <Field label="AI usage" value={overview.currentPlan.limits.aiUsage == null ? "Unlimited" : String(overview.currentPlan.limits.aiUsage)} />
            <Field label="Advanced reports" value={overview.currentPlan.limits.advancedReports ? "Yes" : "No"} />
            <Field label="Integrations" value={overview.currentPlan.limits.integrations ? "Yes" : "No"} />
            <Field label="Custom config" value={overview.currentPlan.limits.customConfiguration ? "Yes" : "No"} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usage</CardTitle>
          <CardDescription>Real-data usage snapshot.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Users" value={String(overview.usage.users)} />
          <Field label="Leads" value={String(overview.usage.leads)} />
          <Field label="AI requests" value={String(overview.usage.aiRequests)} />
          <Field label="Documents" value={String(overview.usage.documents)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment Integration</CardTitle>
          <CardDescription>Never stores card numbers or CVV — provider references only.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Field
            label="Provider"
            value={overview.paymentProviderName || "Not configured"}
          />
          <Badge variant={overview.paymentProviderConfigured ? "success" : "warning"} dot>
            {overview.paymentProviderConfigured ? "Configured" : "Configuration required"}
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}
