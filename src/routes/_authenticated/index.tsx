import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getDashboard } from "@/lib/planner.functions";
import { AutopayBadge, Empty, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { dateLabel, daysLabel, inr, QK } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [
    { title: "Dashboard — Subscription Planner" },
    { name: "description", content: "Your active subscriptions, monthly spend and upcoming renewals at a glance." },
    { property: "og:title", content: "Dashboard — Subscription Planner" },
    { property: "og:description", content: "Your active subscriptions, monthly spend and upcoming renewals at a glance." },
  ] }),
  component: Dashboard,
});

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="panel p-5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl font-semibold text-primary">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Dashboard() {
  const { data, isLoading } = useQuery({ queryKey: [...QK.all, "dashboard"], queryFn: () => getDashboard() });
  if (isLoading || !data) return <div className="text-muted-foreground">Loading…</div>;
  return (
    <>
      <PageHeader title={`Hello, ${data.name}`} subtitle="Here's how your subscriptions look today."
        action={<Button asChild><Link to="/browse">Add Subscription</Link></Button>} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Active" value={String(data.count)} hint="subscriptions" />
        <Stat label="Monthly" value={inr(data.monthly)} hint="equivalent spend" />
        <Stat label="Yearly" value={inr(data.yearly)} hint="equivalent spend" />
        <Stat label="Autopay ON" value={String(data.autopayOn)} hint={`${data.dueSoon} renewing within 7 days`} />
      </div>
      {data.count === 0 ? (
        <div className="mt-8"><Empty title="No subscriptions yet" text="Browse 90+ services or add your own to start tracking renewals and spending."
          action={<Button asChild><Link to="/browse">Browse Services</Link></Button>} /></div>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-5">
          <section className="panel p-6 lg:col-span-3">
            <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-semibold">Upcoming renewals</h2><Link to="/reminders" className="text-sm text-primary">View all</Link></div>
            <ul className="divide-y divide-border">
              {data.upcoming.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                  <div><p className="font-medium">{s.service_name}</p><p className="text-xs text-muted-foreground">{s.plan_name} · {dateLabel(s.next_renewal)}</p></div>
                  <div className="text-right"><p className="font-medium">{inr(s.price)}</p><p className={`text-xs ${s.days_remaining <= 3 ? "text-primary" : "text-muted-foreground"}`}>{daysLabel(s.days_remaining)}</p></div>
                </li>
              ))}
            </ul>
          </section>
          <section className="panel p-6 lg:col-span-2">
            <h2 className="mb-4 text-xl font-semibold">Spending by category</h2>
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={data.categories} layout="vertical" margin={{ left: 0, right: 8 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="category" width={110} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number) => inr(v)} cursor={{ fill: "var(--muted)" }} contentStyle={{ borderRadius: 12, border: "1px solid var(--border)" }} />
                  <Bar dataKey="monthly" name="Monthly" fill="var(--primary-soft)" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="panel p-6 lg:col-span-5">
            <h2 className="mb-4 text-xl font-semibold">Recently added</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.recent.map((s) => (
                <div key={s.id} className="rounded-xl border border-border p-4">
                  <div className="flex items-start justify-between"><p className="font-medium">{s.service_name}</p><AutopayBadge on={s.autopay} /></div>
                  <p className="mt-1 text-xs text-muted-foreground">{s.category} · {s.plan_name}</p>
                  <p className="mt-2 text-sm">{inr(s.monthly)}<span className="text-muted-foreground"> /month equiv.</span></p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
