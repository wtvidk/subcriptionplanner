// Pure business logic: dates, cost normalisation, sorting, search, reminders.
import { HashTable, LinkedList, MinHeap, Queue, Trie, mergeSort } from "./ds";
import { CATEGORIES, SERVICES, type Service } from "./catalogue";

export interface Sub {
  id: string; service_id: string | null; service_name: string; category: string; plan_name: string;
  price: number; billing_interval: string; interval_months: number; start_date: string; next_renewal: string;
  autopay: boolean; notes: string | null; is_custom: boolean; status: "active" | "cancelled";
  cancelled_at: string | null; created_at: string;
}
export interface SubView extends Sub { monthly: number; yearly: number; days_remaining: number }

// ---------- Dates (UTC, calendar-correct) ----------
export const isValidDate = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};
const toUTC = (s: string) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
const fmt = (t: number) => new Date(t).toISOString().slice(0, 10);
export const daysBetween = (from: string, to: string) => Math.round((toUTC(to) - toUTC(from)) / 86400000);
export const daysInMonth = (y: number, m0: number) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
/** Adds months, clamping to month end (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(s: string, n: number): string {
  const [y, m, d] = s.split("-").map(Number);
  const total = (m - 1) + n; const ny = y + Math.floor(total / 12); const nm = ((total % 12) + 12) % 12;
  return fmt(Date.UTC(ny, nm, Math.min(d, daysInMonth(ny, nm))));
}
/** If a renewal date is in the past, roll it forward by its billing period until it is today or later. */
export function rollForward(renewal: string, months: number, today: string, anchorDay?: number): string {
  let r = renewal; let k = 0;
  while (daysBetween(today, r) < 0 && k < 1200) {
    k++; r = addMonths(renewal, months * k);
    if (anchorDay) { const [y, m] = r.split("-").map(Number); r = fmt(Date.UTC(y, m - 1, Math.min(anchorDay, daysInMonth(y, m - 1)))); }
  }
  return r;
}
export const todayISO = () => new Date().toISOString().slice(0, 10);

// ---------- Cost normalisation ----------
export const intervalToMonths = (interval: string, custom?: number) =>
  interval === "month" ? 1 : interval === "year" ? 12 : interval === "quarter" ? 3 : interval === "half-year" ? 6 : Math.max(1, custom ?? 1);
export function equivalents(price: number, intervalMonths: number) {
  const monthly = price / intervalMonths;
  return { monthly: Math.round(monthly * 100) / 100, yearly: Math.round(monthly * 12 * 100) / 100 };
}
export function toView(s: Sub, today = todayISO()): SubView {
  const e = equivalents(Number(s.price), s.interval_months);
  return { ...s, price: Number(s.price), ...e, days_remaining: daysBetween(today, s.next_renewal) };
}

// ---------- Sorting (merge sort) ----------
export type SortKey = "price-asc" | "price-desc" | "renewal" | "name" | "category";
const comparators: Record<SortKey, (a: SubView, b: SubView) => number> = {
  "price-asc": (a, b) => a.price - b.price,
  "price-desc": (a, b) => b.price - a.price,
  renewal: (a, b) => a.next_renewal.localeCompare(b.next_renewal),
  name: (a, b) => a.service_name.localeCompare(b.service_name, undefined, { sensitivity: "base" }),
  category: (a, b) => a.category.localeCompare(b.category) || a.price - b.price,
};
export const sortSubs = (subs: SubView[], key: SortKey = "price-asc") => mergeSort(subs, comparators[key] ?? comparators["price-asc"]);

// ---------- Catalogue indexes (hash table + trie) ----------
const serviceIndex = new HashTable<Service>();
const trie = new Trie();
for (const s of SERVICES) {
  serviceIndex.set(s.id, s);
  const words = [s.name, ...s.plans.map((p) => p.name), ...s.categoryIds.map((c) => CATEGORIES.find((x) => x.id === c)!.name)];
  for (const w of words) for (const token of w.toLowerCase().split(/[^a-z0-9+]+/).filter(Boolean)) {
    // index every suffix of each token so partial (substring) matches work via prefix lookup
    for (let i = 0; i < token.length; i++) trie.insert(token.slice(i), s.id);
  }
}
export const getService = (id: string) => serviceIndex.get(id);
/** Case-insensitive partial search across service, plan and category names. Every query word must match. */
export function searchCatalogue(q: string): Service[] {
  const words = q.toLowerCase().split(/[^a-z0-9+]+/).filter(Boolean);
  if (!words.length) return [];
  let result: Set<string> | null = null;
  for (const w of words) {
    const ids = trie.prefix(w);
    result = result ? new Set([...result].filter((x) => ids.has(x))) : new Set(ids);
  }
  return mergeSort([...(result ?? [])].map((id) => serviceIndex.get(id)!), (a, b) => a.name.localeCompare(b.name));
}

// ---------- Renewals (min-heap) & reminders (queue) ----------
export function upcomingRenewals(subs: SubView[], limit = 5): SubView[] {
  const heap = new MinHeap<SubView>((a, b) => a.next_renewal.localeCompare(b.next_renewal));
  for (const s of subs) if (s.status === "active") heap.push(s);
  const out: SubView[] = []; while (heap.size && out.length < limit) out.push(heap.pop()!);
  return out;
}
export interface Reminder { key: string; sub: SubView; interval: number; days: number; read: boolean }
/** Each active sub within the largest interval produces one reminder at the tightest matching interval. */
export function buildReminders(subs: SubView[], intervals: number[], readKeys: Set<string>): Reminder[] {
  const sorted = [...new Set(intervals)].filter((i) => i >= 0).sort((a, b) => a - b);
  if (!sorted.length) return [];
  const queue = new Queue<SubView>();
  for (const s of upcomingRenewals(subs, Infinity)) queue.enqueue(s); // pending events, nearest first
  const out: Reminder[] = [];
  while (queue.size) {
    const s = queue.dequeue()!;
    const d = s.days_remaining;
    if (d < 0) continue;
    const level = sorted.find((i) => d <= i);
    if (level === undefined) continue;
    const key = `${s.id}:${s.next_renewal}:${level}`;
    out.push({ key, sub: s, interval: level, days: d, read: readKeys.has(key) });
  }
  return out;
}

// ---------- Expenses ----------
export function expenseSummary(subs: SubView[]) {
  const active = subs.filter((s) => s.status === "active");
  const byCat = new HashTable<{ category: string; monthly: number; count: number }>();
  const cats: string[] = [];
  let monthly = 0, yearly = 0;
  for (const s of active) {
    monthly += s.monthly; yearly += s.yearly;
    const e = byCat.get(s.category);
    if (e) { e.monthly += s.monthly; e.count++; } else { byCat.set(s.category, { category: s.category, monthly: s.monthly, count: 1 }); cats.push(s.category); }
  }
  const categories = mergeSort(cats.map((c) => byCat.get(c)!), (a, b) => b.monthly - a.monthly)
    .map((c) => ({ ...c, monthly: Math.round(c.monthly * 100) / 100 }));
  const byPrice = mergeSort(active, (a, b) => b.monthly - a.monthly);
  return {
    monthly: Math.round(monthly * 100) / 100, yearly: Math.round(yearly * 100) / 100,
    count: active.length, autopayOn: active.filter((s) => s.autopay).length,
    categories,
    highest: byPrice.slice(0, 5), lowest: byPrice.slice().reverse().slice(0, 5),
    monthlyBilled: active.filter((s) => s.interval_months === 1),
    yearlyBilled: active.filter((s) => s.interval_months === 12),
    otherBilled: active.filter((s) => s.interval_months !== 1 && s.interval_months !== 12),
    breakdown: byPrice,
  };
}

/** Cancelled history as a linked list, newest cancellation first. */
export function cancelledHistory(subs: SubView[]) {
  const list = new LinkedList<SubView>();
  for (const s of mergeSort(subs.filter((x) => x.status === "cancelled"), (a, b) => (a.cancelled_at ?? "").localeCompare(b.cancelled_at ?? ""))) list.prepend(s);
  return list.toArray();
}

// ---------- Validation ----------
export interface SubInput {
  service_id?: string | null; service_name: string; category: string; plan_name: string; price: number;
  billing_interval: string; interval_months?: number; start_date: string; next_renewal: string; autopay: boolean; notes?: string | null;
}
export function validateSub(i: SubInput): string | null {
  if (!i.service_name?.trim()) return "Service name is required.";
  if (i.service_name.length > 80) return "Service name is too long.";
  if (!i.category?.trim()) return "Category is required.";
  if (!i.plan_name?.trim()) return "Plan name is required.";
  if (typeof i.price !== "number" || !Number.isFinite(i.price) || i.price < 0) return "Price must be a number of 0 or more.";
  if (i.price > 10_000_000) return "Price looks too large.";
  if (!["month", "year", "quarter", "half-year", "custom"].includes(i.billing_interval)) return "Choose a billing interval.";
  if (i.billing_interval === "custom" && (!i.interval_months || i.interval_months < 1 || i.interval_months > 120)) return "Custom interval must be 1–120 months.";
  if (!isValidDate(i.start_date)) return "Start date is not valid.";
  if (!isValidDate(i.next_renewal)) return "Next renewal date is not valid.";
  if (daysBetween(i.start_date, i.next_renewal) <= 0) return "Next renewal must be after the start date.";
  if ((i.notes ?? "").length > 500) return "Notes are too long.";
  return null;
}
