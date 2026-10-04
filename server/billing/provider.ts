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

class UnavailablePaymentProvider implements PaymentProvider {
  isConfigured(): boolean {
    // No real gateway is implemented here; an environment key alone is not
    // evidence that this application can authorize or capture a charge.
    return false;
  }

  async charge(): Promise<{ reference: string } | null> {
    // Deliberately not implemented: no external provider credentials.
    return null;
  }
}

export const paymentProvider: PaymentProvider = new UnavailablePaymentProvider();
