import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { getExpenses } from "@/lib/planner.functions";
import type { SubView } from "@/lib/planner-core";
import { Empty, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { inr, intervalLabel, QK } from "@/lib/format";

export const Route = createFileRoute("/expenses")({
  head: () => ({ meta: [
    { title: "Expense Summary — Subscription Planner" },
    { name: "description", content: "Monthly and yearly equivalent subscription spending, by category, in rupees." },
    { property: "og:title", content: "Expense Summary — Subscription Planner" },
    { property: "og:description", content: "Monthly and yearly equivalent subscription spending, by category, in rupees." },
  ] }),
  component: Expenses,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function MiniList({ title, items }: { title: string; items: SubView[] }) {
  return (
    <section className="panel p-6">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {!items.length ? <p className="text-sm text-muted-foreground">None</p> : (
        <ul className="divide-y divide-border text-sm">
          {items.map((s) => <li key={s.id} className="flex justify-between py-2"><span>{s.service_name} <span className="text-muted-foreground">· {s.plan_name}</span></span><span className="font-medium">{inr(s.monthly)}/mo</span></li>)}
        </ul>
      )}
    </section>
  );
}

function Expenses() {
  const { data, isLoading } = useQuery({ queryKey: [...QK.all, "expenses"], queryFn: () => getExpenses() });
  if (isLoading || !data) return <p className="text-muted-foreground">Loading…</p>;
  if (!data.count) return (<><PageHeader title="Expense Summary" /><Empty title="No expenses yet" text="Add a subscription to see your spending." action={<Button asChild><Link to="/browse">Browse Services</Link></Button>} /></>);
  const sum = (a: SubView[]) => a.reduce((t, s) => t + s.monthly, 0);
  return (
    <>
      <PageHeader title="Expense Summary" subtitle="Yearly plans count as price ÷ 12 per month; monthly plans × 12 per year." />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="panel p-5"><p className="text-xs uppercase tracking-wider text-muted-foreground">Monthly equivalent</p><p className="mt-2 font-display text-3xl font-semibold text-primary">{inr(data.monthly)}</p></div>
        <div className="panel p-5"><p className="text-xs uppercase tracking-wider text-muted-foreground">Yearly equivalent</p><p className="mt-2 font-display text-3xl font-semibold text-primary">{inr(data.yearly)}</p></div>
        <div className="panel p-5"><p className="text-xs uppercase tracking-wider text-muted-foreground">Billing mix</p>
          <p className="mt-2 text-sm">{data.monthlyBilled.length} monthly · {inr(sum(data.monthlyBilled))}/mo</p>
          <p className="text-sm">{data.yearlyBilled.length} yearly · {inr(sum(data.yearlyBilled))}/mo</p>
          {data.otherBilled.length > 0 && <p className="text-sm">{data.otherBilled.length} other · {inr(sum(data.otherBilled))}/mo</p>}
        </div>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="panel p-6">
          <h2 className="mb-2 text-lg font-semibold">By category (monthly)</h2>
          <div className="h-60"><ResponsiveContainer><PieChart>
            <Pie data={data.categories} dataKey="monthly" nameKey="category" innerRadius={55} outerRadius={90} paddingAngle={2} stroke="var(--card)">
              {data.categories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v: number) => inr(v)} contentStyle={{ borderRadius: 12, border: "1px solid var(--border)" }} />
          </PieChart></ResponsiveContainer></div>
          <ul className="mt-2 grid gap-1.5 text-sm">
            {data.categories.map((c, i) => (
              <li key={c.category} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} /><span className="flex-1">{c.category}</span><span className="font-medium">{inr(c.monthly)}</span></li>
            ))}
          </ul>
        </section>
        <div className="grid gap-6"><MiniList title="Highest cost" items={data.highest} /><MiniList title="Lowest cost" items={data.lowest} /></div>
      </div>
      <section className="panel mt-6 overflow-x-auto p-6">
        <h2 className="mb-3 text-lg font-semibold">Detailed breakdown</h2>
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-2">Service</th><th>Category</th><th className="text-right">Actual price</th><th className="text-right">Monthly eq.</th><th className="text-right">Yearly eq.</th></tr></thead>
          <tbody className="divide-y divide-border">
            {data.breakdown.map((s) => (
              <tr key={s.id}><td className="py-2.5">{s.service_name} <span className="text-muted-foreground">· {s.plan_name}</span></td><td className="text-muted-foreground">{s.category}</td>
                <td className="text-right">{inr(s.price)}/{intervalLabel(s.billing_interval, s.interval_months)}</td><td className="text-right">{inr(s.monthly)}</td><td className="text-right">{inr(s.yearly)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
