"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Badge } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { formatMoney } from "@/lib/money";

export interface PlanCard {
  name: string;
  description: string | null;
  priceMonthly: number | null;
  limits: {
    userSeats: number;
    leadStorage: number | null;
    aiUsage: number | null;
    advancedReports: boolean;
    integrations: boolean;
    customConfiguration: boolean;
  };
}

export interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  issuedAt: string;
}

export interface PaymentRow {
  id: string;
  provider: string;
  providerReference: string | null;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
}

const RANK: Record<string, number> = { FREE: 0, STARTER: 1, PROFESSIONAL: 2, ENTERPRISE: 3 };

async function api<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.error?.message ?? `Request failed (${res.status}).`);
  }
  return json.data as T;
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  if (limit === null) {
    return (
      <div className="text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-semibold text-foreground">{used} / Unlimited</span>
        </div>
      </div>
    );
  }
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100;
  const warn = pct >= 80;
  return (
    <div className="text-sm">
      <div className="flex justify-between gap-2">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">
          {used} / {limit}
          {warn && <span className="ml-2 text-warning">Approaching limit</span>}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-subtle">
        <div
          className={`h-full rounded-full ${warn ? "bg-warning" : "bg-brand-500"}`}
          style={{ width: `${Math.max(2, pct)}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Plan/subscription management, billing history, payment-method state, and
 * usage indicators. Paid upgrades are honestly gated on provider
 * configuration; no payment is ever faked.
 */
export function BillingManager({
  plans,
  currentPlanName,
  subscriptionStatus,
  paymentConfigured,
  paymentName,
  usage,
  limits,
  invoices,
  payments,
}: {
  plans: PlanCard[];
  currentPlanName: string;
  subscriptionStatus: string | null;
  paymentConfigured: boolean;
  paymentName: string;
  usage: { users: number; leads: number; aiRequests: number; documents: number };
  limits: PlanCard["limits"];
  invoices: InvoiceRow[];
  payments: PaymentRow[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [invoicing, setInvoicing] = useState(false);

  async function changePlan(plan: string) {
    if (busyPlan) return;
    setBusyPlan(plan);
    try {
      await api("/api/billing", "POST", { plan });
      toast({ variant: "success", title: `Plan changed to ${plan}.` });
      router.refresh();
    } catch (e) {
      toast({
        variant: "error",
        title: "Could not change plan",
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusyPlan(null);
    }
  }

  async function cancel() {
    if (cancelling) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm("Cancel the subscription? You will move to Free limits.")
    ) {
      return;
    }
    setCancelling(true);
    try {
      await api("/api/billing", "DELETE");
      toast({ variant: "success", title: "Subscription cancelled." });
      router.refresh();
    } catch (e) {
      toast({
        variant: "error",
        title: "Could not cancel subscription",
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setCancelling(false);
    }
  }

  async function generateInvoice() {
    if (invoicing) return;
    setInvoicing(true);
    try {
      await api("/api/billing/invoices", "POST");
      toast({ variant: "success", title: "Invoice generated." });
      router.refresh();
    } catch (e) {
      toast({
        variant: "error",
        title: "Could not generate invoice",
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setInvoicing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((p) => {
          const isCurrent = p.name === currentPlanName;
          const locked =
            (RANK[p.name] ?? 0) > (RANK[currentPlanName] ?? 0) && p.priceMonthly != null && !paymentConfigured;
          return (
            <div key={p.name} className="flex flex-col rounded-lg border border-border bg-surface p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-foreground">{p.name}</p>
                {isCurrent && <Badge variant="ai">Current</Badge>}
                {locked && <Badge variant="warning">Upgrade locked</Badge>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{p.description ?? ""}</p>
              <p className="mt-2 text-lg font-semibold text-foreground">
                {p.priceMonthly == null ? "Free" : formatMoney(p.priceMonthly, "INR")}
              </p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                <li>{p.limits.userSeats} seats</li>
                <li>{p.limits.leadStorage == null ? "Unlimited" : p.limits.leadStorage} leads</li>
                <li>Advanced reports: {p.limits.advancedReports ? "Yes" : "No"}</li>
                <li>Integrations: {p.limits.integrations ? "Yes" : "No"}</li>
                <li>Custom config: {p.limits.customConfiguration ? "Yes" : "No"}</li>
              </ul>
              <div className="mt-3">
                {isCurrent ? (
                  <span className="text-xs text-muted-foreground">
                    Status: {subscriptionStatus ?? "active"}
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant={locked ? "ghost" : "outline"}
                    loading={busyPlan === p.name}
                    disabled={busyPlan !== null}
                    onClick={() => changePlan(p.name)}
                    title={locked ? "Payment integration is not configured." : undefined}
                  >
                    {locked ? "Locked — provider required" : `Switch to ${p.name}`}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          loading={cancelling}
          disabled={cancelling}
          onClick={cancel}
        >
          Cancel subscription
        </Button>
        <Button
          size="sm"
          variant="outline"
          loading={invoicing}
          disabled={invoicing}
          onClick={generateInvoice}
        >
          Generate invoice
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <p className="font-semibold text-foreground">Usage indicators</p>
          <div className="mt-3 space-y-3">
            <UsageBar label="Users" used={usage.users} limit={limits.userSeats} />
            <UsageBar label="Leads" used={usage.leads} limit={limits.leadStorage} />
            <UsageBar label="AI requests" used={usage.aiRequests} limit={limits.aiUsage} />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <p className="font-semibold text-foreground">Payment method</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Provider: {paymentName || "Not configured"}
          </p>
          <Badge variant={paymentConfigured ? "success" : "warning"} dot>
            {paymentConfigured ? "Configured" : "Configuration required"}
          </Badge>
          <p className="mt-2 text-xs text-faint">
            {paymentConfigured
              ? "Charges reference the configured provider. Card numbers and CVV are never stored."
              : "No payment provider is connected in this deployment. Paid plan changes stay locked and no charge is attempted."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <p className="font-semibold text-foreground">Billing history (invoices)</p>
          {invoices.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No invoices yet.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {invoices.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2">
                  <span className="text-foreground">
                    {i.invoiceNumber} · {i.status}
                  </span>
                  <span className="text-muted-foreground">
                    {formatMoney(i.amount, i.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <p className="font-semibold text-foreground">Payments</p>
          {payments.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No payments recorded. References only — never card data.
            </p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2">
                  <span className="text-foreground">
                    {p.provider}
                    {p.providerReference ? ` · ${p.providerReference}` : ""} · {p.status}
                  </span>
                  <span className="text-muted-foreground">
                    {formatMoney(p.amount, p.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
