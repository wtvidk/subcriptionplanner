import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  buildReminders, cancelledHistory, expenseSummary, intervalToMonths, rollForward, sortSubs, toView,
  todayISO, upcomingRenewals, validateSub, searchCatalogue, type SortKey, type Sub, type SubInput,
} from "./planner-core";

// Each signed-in user only reaches their own rows (row-level security on profile_id = user id).
type Ctx = { sb: SupabaseClient<Database>; uid: string };
const ctx = (c: { supabase: unknown; userId: string }): Ctx => ({ sb: c.supabase as SupabaseClient<Database>, uid: c.userId });
const authed = { GET: () => createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]), POST: () => createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]) };

export const searchServices = createServerFn({ method: "GET" })
  .inputValidator((d: { q: string }) => ({ q: String(d.q ?? "").slice(0, 60) }))
  .handler(async ({ data }) => searchCatalogue(data.q));

async function loadAll({ sb, uid }: Ctx) {
  const { data, error } = await sb.from("subscriptions").select("*").eq("profile_id", uid);
  if (error) throw new Error("Could not load subscriptions.");
  const today = todayISO();
  const rows = data as unknown as Sub[];
  for (const r of rows) {
    if (r.status !== "active") continue;
    const next = rollForward(r.next_renewal, r.interval_months, today, Number(r.start_date.slice(8, 10)));
    if (next !== r.next_renewal) { r.next_renewal = next; await sb.from("subscriptions").update({ next_renewal: next }).eq("id", r.id); }
  }
  return rows.map((r) => toView(r, today));
}

async function loadSettings({ sb, uid }: Ctx) {
  const { data } = await sb.from("reminder_settings").select("*").eq("profile_id", uid).maybeSingle();
  if (data) return data;
  const { data: created, error } = await sb.from("reminder_settings").insert({ profile_id: uid }).select().single();
  if (error) throw new Error("Could not load settings.");
  return created;
}

async function loadReminders(c: Ctx, subs: Awaited<ReturnType<typeof loadAll>>) {
  const settings = await loadSettings(c);
  const { data: reads } = await c.sb.from("reminder_reads").select("reminder_key").eq("profile_id", c.uid);
  return { settings, reminders: buildReminders(subs.filter((s) => s.status === "active"), settings.intervals, new Set((reads ?? []).map((r) => r.reminder_key))) };
}

export const getDashboard = authed.GET().handler(async ({ context }) => {
  const c = ctx(context); const subs = await loadAll(c);
  const active = subs.filter((s) => s.status === "active");
  const exp = expenseSummary(subs);
  const { reminders, settings } = await loadReminders(c, subs);
  return {
    name: settings.display_name, count: exp.count, monthly: exp.monthly, yearly: exp.yearly, autopayOn: exp.autopayOn,
    categories: exp.categories, upcoming: upcomingRenewals(active, 5),
    recent: [...active].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5),
    unread: reminders.filter((r) => !r.read).length, dueSoon: active.filter((s) => s.days_remaining <= 7).length,
  };
});

export const listSubscriptions = authed.GET()
  .inputValidator((d: { sort?: SortKey; category?: string; billing?: string; autopay?: string }) => d)
  .handler(async ({ data, context }) => {
    let subs = (await loadAll(ctx(context))).filter((s) => s.status === "active");
    if (data.category) subs = subs.filter((s) => s.category === data.category);
    if (data.billing === "month") subs = subs.filter((s) => s.interval_months === 1);
    if (data.billing === "year") subs = subs.filter((s) => s.interval_months === 12);
    if (data.autopay === "on") subs = subs.filter((s) => s.autopay);
    if (data.autopay === "off") subs = subs.filter((s) => !s.autopay);
    return sortSubs(subs, data.sort ?? "price-asc");
  });

function normalise(i: SubInput) {
  return {
    service_id: i.service_id ?? null, service_name: i.service_name.trim(), category: i.category.trim(),
    plan_name: i.plan_name.trim(), price: Math.round(i.price * 100) / 100, billing_interval: i.billing_interval,
    interval_months: intervalToMonths(i.billing_interval, i.interval_months), start_date: i.start_date,
    next_renewal: i.next_renewal, autopay: !!i.autopay, notes: i.notes?.trim() || null, is_custom: !i.service_id,
  };
}

export const createSubscription = authed.POST().inputValidator((d: SubInput) => d).handler(async ({ data, context }) => {
  const err = validateSub(data); if (err) throw new Error(err);
  const { sb, uid } = ctx(context); const row = normalise(data);
  const { data: dup } = await sb.from("subscriptions").select("id").eq("profile_id", uid).eq("status", "active")
    .eq("service_name", row.service_name).eq("plan_name", row.plan_name).gte("created_at", new Date(Date.now() - 10000).toISOString());
  if (dup?.length) throw new Error("This subscription was just added.");
  const { error } = await sb.from("subscriptions").insert({ ...row, profile_id: uid });
  if (error) throw new Error("Could not save the subscription.");
  return { ok: true };
});

export const updateSubscription = authed.POST().inputValidator((d: { id: string; input: SubInput }) => d).handler(async ({ data, context }) => {
  const err = validateSub(data.input); if (err) throw new Error(err);
  const { sb, uid } = ctx(context);
  const { service_id: _s, is_custom: _c, ...row } = normalise(data.input);
  const { error } = await sb.from("subscriptions").update({ ...row, updated_at: new Date().toISOString() }).eq("id", data.id).eq("profile_id", uid).eq("status", "active");
  if (error) throw new Error("Could not update the subscription.");
  return { ok: true };
});

export const setAutopay = authed.POST().inputValidator((d: { id: string; autopay: boolean }) => d).handler(async ({ data, context }) => {
  const { sb, uid } = ctx(context);
  const { error } = await sb.from("subscriptions").update({ autopay: !!data.autopay }).eq("id", data.id).eq("profile_id", uid);
  if (error) throw new Error("Could not update autopay.");
  return { ok: true };
});

export const cancelSubscription = authed.POST().inputValidator((d: { id: string }) => d).handler(async ({ data, context }) => {
  const { sb, uid } = ctx(context);
  const { data: rows, error } = await sb.from("subscriptions").update({ status: "cancelled", cancelled_at: todayISO() }).eq("id", data.id).eq("profile_id", uid).eq("status", "active").select("id");
  if (error || !rows?.length) throw new Error("Subscription not found or already cancelled.");
  return { ok: true };
});

export const restoreSubscription = authed.POST().inputValidator((d: { id: string }) => d).handler(async ({ data, context }) => {
  const { sb, uid } = ctx(context);
  const { data: rows, error } = await sb.from("subscriptions").update({ status: "active", cancelled_at: null }).eq("id", data.id).eq("profile_id", uid).eq("status", "cancelled").select("id");
  if (error || !rows?.length) throw new Error("Subscription not found or already active.");
  return { ok: true };
});

export const getHistory = authed.GET().handler(async ({ context }) => cancelledHistory(await loadAll(ctx(context))));
export const getExpenses = authed.GET().handler(async ({ context }) => expenseSummary(await loadAll(ctx(context))));
export const getReminders = authed.GET().handler(async ({ context }) => { const c = ctx(context); return loadReminders(c, await loadAll(c)); });
export const getSettings = authed.GET().handler(async ({ context }) => loadSettings(ctx(context)));

export const markRemindersRead = authed.POST().inputValidator((d: { keys: string[] }) => d).handler(async ({ data, context }) => {
  if (!data.keys.length) return { ok: true };
  const { sb, uid } = ctx(context);
  await sb.from("reminder_reads").upsert(data.keys.slice(0, 200).map((k) => ({ profile_id: uid, reminder_key: String(k) })));
  return { ok: true };
});

export const updateSettings = authed.POST()
  .inputValidator((d: { intervals: number[]; browser_notifications: boolean; display_name: string }) => d)
  .handler(async ({ data, context }) => {
    const c = ctx(context);
    const intervals = [...new Set(data.intervals.map(Number))].filter((n) => Number.isInteger(n) && n >= 0 && n <= 60);
    const name = (data.display_name ?? "").trim().slice(0, 40) || "Friend";
    await loadSettings(c);
    const { error } = await c.sb.from("reminder_settings").update({ intervals, browser_notifications: !!data.browser_notifications, display_name: name, updated_at: new Date().toISOString() }).eq("profile_id", c.uid);
    if (error) throw new Error("Could not save settings.");
    return { ok: true };
  });
