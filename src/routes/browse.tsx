import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import * as Icons from "lucide-react";
import { ArrowLeft, Plus, Search } from "lucide-react";
import { CATEGORIES, SERVICES, categoryName, type Service } from "@/lib/catalogue";
import { searchServices } from "@/lib/planner.functions";
import { PageHeader } from "@/components/AppShell";
import { SubscriptionDialog, type DialogTarget } from "@/components/SubscriptionDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/browse")({
  validateSearch: (s: Record<string, unknown>) => ({ category: typeof s.category === "string" ? s.category : undefined }),
  head: () => ({ meta: [
    { title: "Browse Services — Subscription Planner" },
    { name: "description", content: "Search 90+ services by name, plan or category and add the plan you pay for." },
    { property: "og:title", content: "Browse Services — Subscription Planner" },
    { property: "og:description", content: "Search 90+ services by name, plan or category and add the plan you pay for." },
  ] }),
  component: Browse,
});

export function CatIcon({ name, className }: { name: string; className?: string }) {
  const I = (Icons as unknown as Record<string, Icons.LucideIcon>)[name] ?? Icons.Circle;
  return <I className={className} />;
}

function ServiceCard({ s, onOpen }: { s: Service; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="panel panel-hover p-5 text-left">
      <p className="font-medium">{s.name}</p>
      <p className="mt-1 text-xs text-muted-foreground">{s.categoryIds.map(categoryName).join(" · ")}</p>
      <p className="mt-3 text-sm">from <span className="font-medium text-primary">{inr(Math.min(...s.plans.map((p) => p.price)))}</span> · {s.plans.length} plan{s.plans.length > 1 ? "s" : ""}</p>
    </button>
  );
}

function Browse() {
  const { category: initialCat } = Route.useSearch();
  const [q, setQ] = useState(""); const [debounced, setDebounced] = useState("");
  const [cat, setCat] = useState<string | null>(initialCat ?? null);
  const [svc, setSvc] = useState<Service | null>(null);
  const [dlg, setDlg] = useState<DialogTarget | null>(null);
  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 200); return () => clearTimeout(t); }, [q]);
  useEffect(() => { setCat(initialCat ?? null); }, [initialCat]);
  const { data: results, isFetching } = useQuery({ queryKey: ["search", debounced], queryFn: () => searchServices({ data: { q: debounced } }), enabled: debounced.length > 0 });

  return (
    <>
      <PageHeader title="Browse Services" subtitle="Find a service, pick the plan you pay for, and add it."
        action={<Button variant="outline" onClick={() => setDlg({ mode: "add" })}><Plus className="h-4 w-4" />Other service</Button>} />
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => { setQ(e.target.value); setSvc(null); }} placeholder="Search by service, plan or category…" className="h-12 rounded-2xl bg-card pl-11 text-base" />
      </div>

      {svc ? (
        <section>
          <button onClick={() => setSvc(null)} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Back</button>
          <div className="panel p-6">
            <h2 className="text-2xl font-semibold">{svc.name}</h2>
            <p className="text-sm text-muted-foreground">{svc.categoryIds.map(categoryName).join(" · ")}</p>
            <ul className="mt-5 divide-y divide-border">
              {svc.plans.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div><p className="font-medium">{p.name}</p><p className="text-sm text-muted-foreground">{inr(p.price)} / {p.interval}</p></div>
                  <Button size="sm" onClick={() => setDlg({ mode: "add", service: svc, planId: p.id })}>Select Plan</Button>
                </li>
              ))}
              <li className="flex items-center justify-between py-3">
                <p className="text-sm text-muted-foreground">Paying for a different plan?</p>
                <Button size="sm" variant="outline" onClick={() => setDlg({ mode: "add", service: svc, planId: "__none" })}>Other Plan</Button>
              </li>
            </ul>
          </div>
        </section>
      ) : debounced ? (
        <section>
          <p className="mb-4 text-sm text-muted-foreground">{isFetching ? "Searching…" : `${results?.length ?? 0} result(s) for “${debounced}”`}</p>
          {results && results.length === 0 && !isFetching ? (
            <div className="panel p-8 text-center">
              <p className="text-muted-foreground">No services match. You can add it yourself.</p>
              <Button className="mt-4" onClick={() => setDlg({ mode: "add" })}>Add custom service</Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{results?.map((s) => <ServiceCard key={s.id} s={s} onOpen={() => setSvc(s)} />)}</div>
          )}
        </section>
      ) : cat ? (
        <section>
          <button onClick={() => setCat(null)} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />All categories</button>
          <h2 className="mb-4 text-2xl font-semibold">{categoryName(cat)}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.filter((s) => s.categoryIds.includes(cat)).map((s) => <ServiceCard key={s.id} s={s} onOpen={() => setSvc(s)} />)}
          </div>
        </section>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {CATEGORIES.map((c) => (
            <button key={c.id} onClick={() => setCat(c.id)} className="panel panel-hover flex flex-col items-start gap-4 p-5 text-left">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary"><CatIcon name={c.icon} className="h-5 w-5" /></span>
              <div><p className="text-sm font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{SERVICES.filter((s) => s.categoryIds.includes(c.id)).length} services</p></div>
            </button>
          ))}
        </div>
      )}
      <SubscriptionDialog target={dlg} onClose={() => setDlg(null)} />
    </>
  );
}
