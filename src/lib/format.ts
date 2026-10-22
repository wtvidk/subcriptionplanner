export const inr = (n: number) =>
  "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const intervalLabel = (interval: string, months = 1) =>
  interval === "month" ? "month" : interval === "year" ? "year" : interval === "quarter" ? "quarter" : interval === "half-year" ? "6 months" : `${months} months`;
export const dateLabel = (s: string) =>
  new Date(s + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export const daysLabel = (d: number) => (d === 0 ? "Today" : d === 1 ? "Tomorrow" : d < 0 ? `${-d} days ago` : `In ${d} days`);
export const QK = { all: ["planner"] as const };
