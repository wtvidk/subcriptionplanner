import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { getHistory, restoreSubscription } from "@/lib/planner.functions";
import type { SubView } from "@/lib/planner-core";
import { Empty, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { dateLabel, inr, intervalLabel, QK } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [
    { title: "Cancelled History — Subscription Planner" },
    { name: "description", content: "Every subscription you've cancelled, with original price and dates." },
    { property: "og:title", content: "Cancelled History — Subscription Planner" },
    { property: "og:description", content: "Every subscription you've cancelled, with original price and dates." },
  ] }),
  component: History,
});

function History() {
  const qc = useQueryClient();
  const [restoring, setRestoring] = useState<SubView | null>(null);
  const { data, isLoading } = useQuery({ queryKey: [...QK.all, "history"], queryFn: () => getHistory() });
  const restore = useMutation({ mutationFn: (id: string) => restoreSubscription({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: QK.all }); toast.success("Restored to My Subscriptions"); setRestoring(null); }, onError: (e: Error) => toast.error(e.message) });
  return (
    <>
      <PageHeader title="Cancelled History" subtitle="Newest cancellations first. Records are kept, never deleted." />
      {isLoading ? <p className="text-muted-foreground">Loading…</p> : !data?.length ? (
        <Empty title="No cancelled subscriptions" text="When you cancel a subscription, it will appear here." />
      ) : (
        <ul className="grid gap-3">
          {data.map((s) => (
            <li key={s.id} className="panel flex flex-wrap items-center gap-4 p-5">
              <div className="min-w-48 flex-1">
                <p className="font-medium">{s.service_name} <span className="text-muted-foreground">· {s.plan_name}</span></p>
                <p className="text-xs text-muted-foreground">{s.category} · started {dateLabel(s.start_date)} · last renewal {dateLabel(s.next_renewal)}</p>
              </div>
              <div className="text-right text-sm"><p className="font-medium">{inr(s.price)}/{intervalLabel(s.billing_interval, s.interval_months)}</p><p className="text-xs text-muted-foreground">Cancelled {s.cancelled_at ? dateLabel(s.cancelled_at) : ""}</p></div>
              <Button size="sm" variant="outline" onClick={() => setRestoring(s)}>Restore</Button>
            </li>
          ))}
        </ul>
      )}
      <AlertDialog open={!!restoring} onOpenChange={(o) => !o && setRestoring(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Restore {restoring?.service_name}?</AlertDialogTitle>
            <AlertDialogDescription>It goes back to My Subscriptions and counts toward spending again.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Not now</AlertDialogCancel>
            <AlertDialogAction disabled={restore.isPending} onClick={(e) => { e.preventDefault(); restoring && restore.mutate(restoring.id); }}>Restore</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
