import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, X } from "lucide-react";
import { cancelSubscription, listSubscriptions, setAutopay } from "@/lib/planner.functions";
import type { SortKey, SubView } from "@/lib/planner-core";
import { CATEGORIES } from "@/lib/catalogue";
import { Empty, PageHeader } from "@/components/AppShell";
import { SubscriptionDialog, type DialogTarget } from "@/components/SubscriptionDialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { dateLabel, daysLabel, inr, intervalLabel, QK } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/subscriptions")({
  head: () => ({ meta: [
    { title: "My Subscriptions — Subscription Planner" },
    { name: "description", content: "All your active subscriptions, sorted by price, with renewals and autopay status." },
    { property: "og:title", content: "My Subscriptions — Subscription Planner" },
    { property: "og:description", content: "All your active subscriptions, sorted by price, with renewals and autopay status." },
  ] }),
  component: MySubs,
});

const sel = "h-9 rounded-lg border border-input bg-card px-3 text-sm";

function MySubs() {
  const qc = useQueryClient();
  const [sort, setSort] = useState<SortKey>("price-asc");
  const [category, setCategory] = useState(""); const [billing, setBilling] = useState(""); const [autopay, setAp] = useState("");
  const [dlg, setDlg] = useState<DialogTarget | null>(null);
  const [cancelling, setCancelling] = useState<SubView | null>(null);
  const { data, isLoading } = useQuery({ queryKey: [...QK.all, "subs", sort, category, billing, autopay], queryFn: () => listSubscriptions({ data: { sort, category, billing, autopay } }) });
  const refresh = () => qc.invalidateQueries({ queryKey: QK.all });
  const ap = useMutation({ mutationFn: (v: { id: string; autopay: boolean }) => setAutopay({ data: v }), onSuccess: () => { refresh(); toast.success("Autopay updated"); }, onError: (e: Error) => toast.error(e.message) });
  const cancel = useMutation({ mutationFn: (id: string) => cancelSubscription({ data: { id } }), onSuccess: () => { refresh(); toast.success("Moved to Cancelled History"); setCancelling(null); }, onError: (e: Error) => toast.error(e.message) });
  const filtering = category || billing || autopay;

  return (
    <>
      <PageHeader title="My Subscriptions" subtitle="Sorted lowest to highest price by default." action={<Button asChild><Link to="/browse">Add Subscription</Link></Button>} />
      <div className="mb-6 flex flex-wrap gap-2">
        <select className={sel} value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort">
          <option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option>
          <option value="renewal">Nearest renewal</option><option value="name">Name A–Z</option><option value="category">Category</option>
        </select>
        <select className={sel} value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
          <option value="">All categories</option>{CATEGORIES.map((c) => <option key={c.id}>{c.name}</option>)}
        </select>
        <select className={sel} value={billing} onChange={(e) => setBilling(e.target.value)} aria-label="Billing"><option value="">Any billing</option><option value="month">Monthly</option><option value="year">Yearly</option></select>
        <select className={sel} value={autopay} onChange={(e) => setAp(e.target.value)} aria-label="Autopay"><option value="">Autopay any</option><option value="on">Autopay ON</option><option value="off">Autopay OFF</option></select>
      </div>
      {isLoading ? <p className="text-muted-foreground">Loading…</p> : !data?.length ? (
        <Empty title={filtering ? "Nothing matches these filters" : "No active subscriptions"} text={filtering ? "Try clearing a filter." : "Add one from Browse Services."}
          action={!filtering && <Button asChild><Link to="/browse">Browse Services</Link></Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((s) => (
            <article key={s.id} className="panel p-5">
              <div className="flex items-start justify-between gap-3">
                <div><h3 className="text-lg font-semibold">{s.service_name}</h3><p className="text-xs text-muted-foreground">{s.category} · {s.plan_name}</p></div>
                <div className="text-right"><p className="font-display text-xl font-semibold text-primary">{inr(s.price)}</p><p className="text-xs text-muted-foreground">per {intervalLabel(s.billing_interval, s.interval_months)}</p></div>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-muted p-3 text-xs">
                <div><dt className="text-muted-foreground">Monthly eq.</dt><dd className="font-medium">{inr(s.monthly)}</dd></div>
                <div><dt className="text-muted-foreground">Yearly eq.</dt><dd className="font-medium">{inr(s.yearly)}</dd></div>
                <div><dt className="text-muted-foreground">Renews</dt><dd className="font-medium">{dateLabel(s.next_renewal)}</dd><dd className={s.days_remaining <= 3 ? "text-primary" : "text-muted-foreground"}>{daysLabel(s.days_remaining)}</dd></div>
              </dl>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm"><Switch checked={s.autopay} onCheckedChange={(v) => ap.mutate({ id: s.id, autopay: v })} />Autopay {s.autopay ? "ON" : "OFF"}</label>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setDlg({ mode: "edit", sub: s })}><Pencil className="h-3.5 w-3.5" />Edit</Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setCancelling(s)}><X className="h-3.5 w-3.5" />Cancel</Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <SubscriptionDialog target={dlg} onClose={() => setDlg(null)} />
      <AlertDialog open={!!cancelling} onOpenChange={(o) => !o && setCancelling(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel {cancelling?.service_name}?</AlertDialogTitle>
            <AlertDialogDescription>It moves to Cancelled History and stops counting toward your spending. This only updates your tracker.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction disabled={cancel.isPending} onClick={(e) => { e.preventDefault(); cancelling && cancel.mutate(cancelling.id); }}>Cancel subscription</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
