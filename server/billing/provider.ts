import { serverEnv } from "@/config/env";

/**
 * Payment provider abstraction (Phase 16).
 *
 * The billing data model stores invoices/payments with provider references only
 * — NEVER raw card numbers, CVV, or payment credentials. If provider
 * credentials are unavailable, `isConfigured()` returns false and no
 * successful payment is fabricated.
 */

export interface ChargeInput {
  /** Provider-side customer/token reference (never raw card data). */
  customerReference: string;
  amount: number;
  currency: string;
  description?: string;
}

export interface PaymentProvider {
  isConfigured(): boolean;
  /** Returns a provider reference on success, or null when not configured. */
  charge(input: ChargeInput): Promise<{ reference: string } | null>;
}

class NoopPaymentProvider implements PaymentProvider {
  isConfigured(): boolean {
    return Boolean(serverEnv.paymentProviderApiKey);
  }

  async charge(): Promise<{ reference: string } | null> {
    // Deliberately not implemented: no external provider credentials.
    return null;
  }
}

export const paymentProvider: PaymentProvider = new NoopPaymentProvider();
