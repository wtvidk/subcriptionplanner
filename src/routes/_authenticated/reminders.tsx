import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getReminders, markRemindersRead } from "@/lib/planner.functions";
import { AutopayBadge, Empty, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { dateLabel, daysLabel, inr, QK } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/reminders")({
  head: () => ({ meta: [
    { title: "Renewal Reminders — Subscription Planner" },
    { name: "description", content: "Reminders 7, 3 and 1 day before each renewal, and on the day itself." },
    { property: "og:title", content: "Renewal Reminders — Subscription Planner" },
    { property: "og:description", content: "Reminders 7, 3 and 1 day before each renewal, and on the day itself." },
  ] }),
  component: Reminders,
});

function Reminders() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: [...QK.all, "reminders"], queryFn: () => getReminders() });
  const mark = useMutation({ mutationFn: (keys: string[]) => markRemindersRead({ data: { keys } }), onSuccess: () => qc.invalidateQueries({ queryKey: QK.all }), onError: (e: Error) => toast.error(e.message) });
  const unread = data?.reminders.filter((r) => !r.read) ?? [];
  const intervals = [...(data?.settings.intervals ?? [])].sort((a, b) => b - a);

  return (
    <>
      <PageHeader title="Renewal Reminders"
        subtitle={intervals.length ? `Reminding you ${intervals.map((i) => (i === 0 ? "on the day" : `${i} day${i > 1 ? "s" : ""} before`)).join(", ")}.` : "All reminder intervals are off."}
        action={<div className="flex gap-2">
          <Button variant="outline" asChild><Link to="/settings">Change intervals</Link></Button>
          {unread.length > 0 && <Button onClick={() => mark.mutate(unread.map((r) => r.key))}>Mark all read</Button>}
        </div>} />
      {isLoading ? <p className="text-muted-foreground">Loading…</p> : !data?.reminders.length ? (
        <Empty title="No reminders right now" text="Nothing renews within your reminder window. You're all caught up." />
      ) : (
        <ul className="grid gap-3">
          {data.reminders.map((r) => (
            <li key={r.key} className={`panel flex flex-wrap items-center gap-4 p-5 ${r.read ? "opacity-70" : ""}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${r.read ? "bg-border" : "bg-primary"}`} aria-label={r.read ? "Read" : "Unread"} />
              <div className="min-w-40 flex-1">
                <p className="font-medium">{r.sub.service_name} <span className="text-muted-foreground">· {r.sub.plan_name}</span></p>
                <p className="text-xs text-muted-foreground">Renews {dateLabel(r.sub.next_renewal)} · {r.interval === 0 ? "Renewal day" : `${r.interval}-day reminder`}</p>
              </div>
              <AutopayBadge on={r.sub.autopay} />
              <div className="text-right"><p className="font-medium">{inr(r.sub.price)}</p><p className={`text-xs ${r.days <= 1 ? "text-primary" : "text-muted-foreground"}`}>{daysLabel(r.days)}</p></div>
              {!r.read && <Button size="sm" variant="ghost" onClick={() => mark.mutate([r.key])}>Dismiss</Button>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
