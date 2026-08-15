/**
 * Money formatting helper — uses the organization's currency without
 * hardcoding ₹. Canonical amounts stay numeric; this only formats for display.
 */

export function formatMoney(
  amount: number | null | undefined,
  currency = "INR",
  locale = "en-IN",
): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}
