import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORIES, categoryName, type Service } from "@/lib/catalogue";
import { addMonths, equivalents, intervalToMonths, todayISO, validateSub, type SubInput, type SubView } from "@/lib/planner-core";
import { createSubscription, updateSubscription } from "@/lib/planner.functions";
import { inr, intervalLabel, dateLabel, QK } from "@/lib/format";

export type DialogTarget =
  | { mode: "add"; service?: Service; planId?: string }
  | { mode: "edit"; sub: SubView };

const OTHER = "__other";
const selectCls = "h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export function SubscriptionDialog({ target, onClose }: { target: DialogTarget | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [step, setStep] = useState<"form" | "review">("form");
  const [f, setF] = useState({
    serviceName: "", categorySel: CATEGORIES[0].name, categoryOther: "", planSel: OTHER, planName: "",
    price: "", interval: "month", months: "2", start: todayISO(), renewal: addMonths(todayISO(), 1), autopay: false, notes: "",
  });
  const service = target?.mode === "add" ? target.service : undefined;

  useEffect(() => {
    if (!target) return;
    setStep("form");
    const t = todayISO();
    if (target.mode === "edit") {
      const s = target.sub;
      const known = CATEGORIES.some((c) => c.name === s.category);
      setF({ serviceName: s.service_name, categorySel: known ? s.category : OTHER, categoryOther: known ? "" : s.category,
        planSel: OTHER, planName: s.plan_name, price: String(s.price), interval: s.billing_interval, months: String(s.interval_months),
        start: s.start_date, renewal: s.next_renewal, autopay: s.autopay, notes: s.notes ?? "" });
    } else {
      const sv = target.service; const plan = sv?.plans.find((p) => p.id === target.planId) ?? sv?.plans[0];
      setF({ serviceName: sv?.name ?? "", categorySel: sv ? categoryName(sv.categoryIds[0]) : CATEGORIES[0].name, categoryOther: "",
        planSel: plan?.id ?? OTHER, planName: plan?.name ?? "", price: plan ? String(plan.price) : "", interval: plan?.interval ?? "month",
        months: "2", start: t, renewal: addMonths(t, plan?.interval === "year" ? 12 : 1), autopay: false, notes: "" });
    }
  }, [target]);

  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  const months = intervalToMonths(f.interval, Number(f.months));
  const input: SubInput = {
    service_id: service?.id ?? (target?.mode === "edit" ? target.sub.service_id : null),
    service_name: f.serviceName, category: f.categorySel === OTHER ? f.categoryOther : f.categorySel,
    plan_name: f.planName, price: f.price === "" ? NaN : Number(f.price), billing_interval: f.interval,
    interval_months: months, start_date: f.start, next_renewal: f.renewal, autopay: f.autopay, notes: f.notes,
  };
  const error = validateSub(input);

  const choosePlan = (id: string) => {
    if (id === OTHER) { setF((p) => ({ ...p, planSel: OTHER, planName: "", price: "" })); return; }
    const p = service!.plans.find((x) => x.id === id)!;
    setF((prev) => ({ ...prev, planSel: id, planName: p.name, price: String(p.price), interval: p.interval, renewal: addMonths(prev.start, p.interval === "year" ? 12 : 1) }));
  };
  const changeStart = (v: string) => setF((p) => ({ ...p, start: v, renewal: /^\d{4}-\d{2}-\d{2}$/.test(v) ? addMonths(v, intervalToMonths(p.interval, Number(p.months))) : p.renewal }));
  const changeInterval = (v: string) => setF((p) => ({ ...p, interval: v, renewal: addMonths(p.start, intervalToMonths(v, Number(p.months))) }));

  const mut = useMutation({
    mutationFn: () => target?.mode === "edit" ? updateSubscription({ data: { id: target.sub.id, input } }) : createSubscription({ data: input }),
    onSuccess: () => { toast.success(target?.mode === "edit" ? "Subscription updated" : "Subscription added"); qc.invalidateQueries({ queryKey: QK.all }); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const eq = Number.isFinite(input.price) ? equivalents(input.price, months) : null;
  const isEdit = target?.mode === "edit";

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{isEdit ? "Edit subscription" : step === "review" ? "Review subscription" : service ? `Add ${service.name}` : "Add custom service"}</DialogTitle>
          <DialogDescription>{step === "review" ? "Check the details before saving." : "Prices in Indian rupees. Autopay is for tracking only."}</DialogDescription>
        </DialogHeader>

        {step === "form" ? (
          <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (!error) setStep("review"); }}>
            <div className="grid gap-1.5">
              <Label>Service name</Label>
              <Input value={f.serviceName} disabled={!!service} onChange={(e) => set("serviceName", e.target.value)} placeholder="e.g. Local gym" maxLength={80} />
            </div>
            <div className="grid gap-1.5">
              <Label>Category</Label>
              <select className={selectCls} value={f.categorySel} onChange={(e) => set("categorySel", e.target.value)}>
                {(service ? service.categoryIds.map(categoryName) : CATEGORIES.map((c) => c.name)).map((n) => <option key={n}>{n}</option>)}
                {!service && <option value={OTHER}>Other…</option>}
              </select>
              {f.categorySel === OTHER && <Input placeholder="Custom category name" value={f.categoryOther} onChange={(e) => set("categoryOther", e.target.value)} maxLength={40} />}
            </div>
            {service && (
              <div className="grid gap-1.5">
                <Label>Plan</Label>
                <select className={selectCls} value={f.planSel} onChange={(e) => choosePlan(e.target.value)}>
                  {service.plans.map((p) => <option key={p.id} value={p.id}>{p.name} — {inr(p.price)}/{p.interval}</option>)}
                  <option value={OTHER}>Other plan…</option>
                </select>
              </div>
            )}
            {(!service || f.planSel === OTHER) && (
              <div className="grid gap-1.5">
                <Label>Plan name</Label>
                <Input value={f.planName} onChange={(e) => set("planName", e.target.value)} placeholder="e.g. Basic" maxLength={60} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Price you pay (₹)</Label>
                <Input type="number" min={0} step="0.01" inputMode="decimal" value={f.price} onChange={(e) => set("price", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Billing interval</Label>
                <select className={selectCls} value={f.interval} onChange={(e) => changeInterval(e.target.value)}>
                  <option value="month">Monthly</option><option value="quarter">Quarterly</option>
                  <option value="half-year">Every 6 months</option><option value="year">Yearly</option><option value="custom">Other…</option>
                </select>
              </div>
            </div>
            {f.interval === "custom" && (
              <div className="grid gap-1.5">
                <Label>Bills every (months)</Label>
                <Input type="number" min={1} max={120} value={f.months} onChange={(e) => { set("months", e.target.value); }} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>Start date</Label><Input type="date" value={f.start} onChange={(e) => changeStart(e.target.value)} /></div>
              <div className="grid gap-1.5"><Label>Next renewal</Label><Input type="date" value={f.renewal} onChange={(e) => set("renewal", e.target.value)} /></div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
              <div><p className="text-sm font-medium">Autopay</p><p className="text-xs text-muted-foreground">Tracking only — doesn't change real payments</p></div>
              <Switch checked={f.autopay} onCheckedChange={(v) => set("autopay", v)} />
            </div>
            <div className="grid gap-1.5"><Label>Notes (optional)</Label><Textarea rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} maxLength={500} /></div>
            {error && f.price !== "" && <p className="text-sm text-destructive">{error}</p>}
            {isEdit ? (
              <Button type="button" disabled={!!error || mut.isPending} onClick={() => mut.mutate()}>{mut.isPending ? "Saving…" : "Save changes"}</Button>
            ) : (
              <Button type="submit" disabled={!!error}>Review</Button>
            )}
          </form>
        ) : (
          <div className="grid gap-4">
            <dl className="grid grid-cols-2 gap-y-2.5 rounded-xl bg-muted p-4 text-sm">
              {[
                ["Service", input.service_name], ["Category", input.category], ["Plan", input.plan_name],
                ["Price", `${inr(input.price)} / ${intervalLabel(f.interval, months)}`],
                ["Monthly equivalent", eq ? inr(eq.monthly) : "—"], ["Yearly equivalent", eq ? inr(eq.yearly) : "—"],
                ["Start date", dateLabel(input.start_date)], ["Next renewal", dateLabel(input.next_renewal)],
                ["Autopay", input.autopay ? "ON" : "OFF"],
              ].map(([k, v]) => (<><dt key={k} className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></>))}
            </dl>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep("form")}>Back</Button>
              <Button className="flex-1" disabled={mut.isPending} onClick={() => mut.mutate()}>{mut.isPending ? "Adding…" : "Add Subscription"}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
