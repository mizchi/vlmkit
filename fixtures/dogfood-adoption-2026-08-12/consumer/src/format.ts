/** Money as the console shows it. Deliberately boring: this is the code that has tests. */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export function orderState(shipped: boolean, cancelled: boolean): "cancelled" | "shipped" | "open" {
  if (cancelled) return "cancelled";
  return shipped ? "shipped" : "open";
}
