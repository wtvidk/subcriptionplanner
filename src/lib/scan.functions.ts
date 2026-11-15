import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SERVICES, CATEGORIES, type Service } from "./catalogue";

export interface ScanExtract {
  readable: boolean; service_name: string | null; plan_name: string | null; price: number | null;
  currency: string | null; billing: "month" | "year" | "quarter" | "half-year" | null;
  renewal_date: string | null; category_guess: string | null; notes: string | null;
}
export interface ScanMatch { serviceId: string; name: string; planId: string | null; planName: string | null; score: number; exact: boolean }
export interface ScanResult { extract: ScanExtract; matches: ScanMatch[]; categoryId: string | null; duplicateOf: string | null }

const norm = (s: string) => s.toLowerCase().replace(/\+/g, "plus").replace(/[^a-z0-9]/g, "");
function similarity(a: string, b: string) {
  const x = norm(a), y = norm(b); if (!x || !y) return 0; if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.85 * Math.min(x.length, y.length) / Math.max(x.length, y.length) + 0.15;
  // bigram Dice coefficient
  const bg = (s: string) => { const m = new Map<string, number>(); for (let i = 0; i < s.length - 1; i++) { const k = s.slice(i, i + 2); m.set(k, (m.get(k) ?? 0) + 1); } return m; };
  const A = bg(x), B = bg(y); let inter = 0; for (const [k, v] of A) inter += Math.min(v, B.get(k) ?? 0);
  return (2 * inter) / Math.max(1, x.length - 1 + y.length - 1);
}
function pickPlan(s: Service, plan: string | null, price: number | null, billing: string | null) {
  let best = null as null | { id: string; name: string; score: number };
  for (const p of s.plans) {
    let sc = plan ? similarity(plan, p.name) : 0;
    if (price != null && Math.abs(p.price - price) < 0.5) sc += 0.6;
    if (billing && billing === p.interval) sc += 0.2;
    if (!best || sc > best.score) best = { id: p.id, name: p.name, score: sc };
  }
  return best && best.score >= 0.5 ? best : null;
}
export function matchCatalogue(e: ScanExtract): ScanMatch[] {
  if (!e.service_name) return [];
  return SERVICES.map((s) => ({ s, score: similarity(e.service_name!, s.name) }))
    .filter((x) => x.score >= 0.45).sort((a, b) => b.score - a.score).slice(0, 3)
    .map(({ s, score }) => { const p = pickPlan(s, e.plan_name, e.price, e.billing);
      return { serviceId: s.id, name: s.name, planId: p?.id ?? null, planName: p?.name ?? null, score: Math.round(score * 100) / 100, exact: score >= 0.95 }; });
}

const SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["readable", "service_name", "plan_name", "price", "currency", "billing", "renewal_date", "category_guess", "notes"],
  properties: {
    readable: { type: "boolean", description: "false if the image has no subscription/payment info or is unreadable" },
    service_name: { type: ["string", "null"], description: "Brand name, e.g. Netflix, Spotify, YouTube Premium" },
    plan_name: { type: ["string", "null"], description: "Tier, e.g. Basic, Premium, Family" },
    price: { type: ["number", "null"], description: "Recurring charge amount as a number" },
    currency: { type: ["string", "null"], description: "ISO code, e.g. INR, USD" },
    billing: { type: ["string", "null"], enum: ["month", "year", "quarter", "half-year", null] },
    renewal_date: { type: ["string", "null"], description: "Next renewal/billing date as YYYY-MM-DD if visible" },
    category_guess: { type: ["string", "null"], enum: [...CATEGORIES.map((c) => c.id), null] },
    notes: { type: ["string", "null"], description: "Short note on anything uncertain" },
  },
} as const;

const MAX_BYTES = 5 * 1024 * 1024;

export const scanSubscription = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .validator((d: { image: string }) => {
    const m = /^data:(image\/(png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(String(d?.image ?? ""));
    if (!m) throw new Error("Please upload a PNG, JPG, WEBP or GIF image.");
    if ((m[3]!.length * 3) / 4 > MAX_BYTES) throw new Error("Image is larger than 5 MB.");
    return { image: d.image };
  })
  .handler(async ({ data, context }): Promise<ScanResult> => {
    const { generateResponse, GatewayError } = await import("@lovable.dev/ai-gateway");
    const today = new Date().toISOString().slice(0, 10);
    let text = "";
    try {
      const res = await generateResponse({
        model: "openai/gpt-6-astra",
        input: [{ role: "user", content: [
          { type: "input_text", text: `Read this screenshot/photo of a subscription, invoice or confirmation page. Understand it (don't just copy text) and extract the recurring subscription details. Today is ${today}; resolve relative dates. Use null for anything not visible. Return JSON.` },
          { type: "input_image", image_url: data.image, detail: "high" },
        ] }],
        text: { format: { type: "json_schema", name: "subscription_scan", strict: true, schema: SCHEMA as unknown as Record<string, unknown> } },
      });
      const r = res as unknown as { output_text?: string; output?: { type: string; content?: { type: string; text?: string }[] }[] };
      text = r.output_text ?? (r.output ?? []).flatMap((o) => o.content ?? []).filter((c) => c.type === "output_text").map((c) => c.text ?? "").join("");
    } catch (e) {
      console.error("scan failed", e instanceof GatewayError ? { code: e.code, status: e.httpStatus } : e);
      if (e instanceof GatewayError && e.httpStatus === 402) throw new Error("AI credits are used up. Please add the subscription manually.");
      if (e instanceof GatewayError && e.httpStatus === 429) throw new Error("Too many scans right now. Please try again in a minute.");
      throw new Error("The scan failed. Please try again or add it manually.");
    }
    let extract: ScanExtract;
    try { extract = JSON.parse(text) as ScanExtract; } catch { throw new Error("Couldn't read the scan result. Please try again."); }
    if (extract.renewal_date && !/^\d{4}-\d{2}-\d{2}$/.test(extract.renewal_date)) extract.renewal_date = null;
    const matches = extract.readable ? matchCatalogue(extract) : [];
    const top = matches[0] ? SERVICES.find((s) => s.id === matches[0]!.serviceId) : undefined;
    const categoryId = top?.categoryIds[0] ?? extract.category_guess ?? null;
    let duplicateOf: string | null = null;
    if (extract.service_name) {
      const { data: subs } = await context.supabase.from("subscriptions").select("service_name, plan_name").eq("profile_id", context.userId).eq("status", "active");
      const names = [extract.service_name, ...matches.map((m) => m.name)];
      const d = (subs ?? []).find((s) => names.some((n) => similarity(n, s.service_name) >= 0.9));
      if (d) duplicateOf = `${d.service_name} · ${d.plan_name}`;
    }
    return { extract, matches, categoryId, duplicateOf };
  });
