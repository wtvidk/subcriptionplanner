import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CATEGORIES, SERVICES } from "@/lib/catalogue";
import { getExpenses } from "@/lib/planner.functions";
import { PageHeader } from "@/components/AppShell";
import { CatIcon } from "./browse";
import { inr, QK } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/categories")({
  head: () => ({ meta: [
    { title: "Categories — Subscription Planner" },
    { name: "description", content: "Ten service categories with your subscription count and monthly spend in each." },
    { property: "og:title", content: "Categories — Subscription Planner" },
    { property: "og:description", content: "Ten service categories with your subscription count and monthly spend in each." },
  ] }),
  component: Categories,
});

function Categories() {
  const { data } = useQuery({ queryKey: [...QK.all, "expenses"], queryFn: () => getExpenses() });
  const known = new Set(CATEGORIES.map((c) => c.name));
  const custom = data?.categories.filter((c) => !known.has(c.category)) ?? [];
  return (
    <>
      <PageHeader title="Categories" subtitle="Your spending in each category. Tap one to browse its services." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((c) => {
          const mine = data?.categories.find((x) => x.category === c.name);
          return (
            <Link key={c.id} to="/browse" search={{ category: c.id }} className="panel panel-hover flex items-center gap-4 p-5">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-primary"><CatIcon name={c.icon} className="h-5 w-5" /></span>
              <div className="flex-1">
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">{SERVICES.filter((s) => s.categoryIds.includes(c.id)).length} services in catalogue</p>
              </div>
              <div className="text-right"><p className="font-medium text-primary">{inr(mine?.monthly ?? 0)}</p><p className="text-xs text-muted-foreground">{mine?.count ?? 0} active</p></div>
            </Link>
          );
        })}
        {custom.map((c) => (
          <div key={c.category} className="panel flex items-center gap-4 p-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground"><CatIcon name="Tag" className="h-5 w-5" /></span>
            <div className="flex-1"><p className="font-medium">{c.category}</p><p className="text-xs text-muted-foreground">Custom category</p></div>
            <div className="text-right"><p className="font-medium text-primary">{inr(c.monthly)}</p><p className="text-xs text-muted-foreground">{c.count} active</p></div>
          </div>
        ))}
      </div>
    </>
  );
}
