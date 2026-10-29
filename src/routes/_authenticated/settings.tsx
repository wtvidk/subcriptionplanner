import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getSettings, updateSettings } from "@/lib/planner.functions";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { QK } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [
    { title: "Settings — Subscription Planner" },
    { name: "description", content: "Set your name, reminder intervals and browser notifications." },
    { property: "og:title", content: "Settings — Subscription Planner" },
    { property: "og:description", content: "Set your name, reminder intervals and browser notifications." },
  ] }),
  component: SettingsPage,
});

const OPTIONS = [{ v: 7, l: "7 days before" }, { v: 3, l: "3 days before" }, { v: 1, l: "1 day before" }, { v: 0, l: "On renewal day" }];

function SettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: [...QK.all, "settings"], queryFn: () => getSettings() });
  const [name, setName] = useState(""); const [intervals, setIntervals] = useState<number[]>([]); const [notify, setNotify] = useState(false);
  useEffect(() => { if (data) { setName(data.display_name); setIntervals(data.intervals); setNotify(data.browser_notifications); } }, [data]);
  const save = useMutation({ mutationFn: () => updateSettings({ data: { display_name: name, intervals, browser_notifications: notify } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: QK.all }); toast.success("Settings saved"); }, onError: (e: Error) => toast.error(e.message) });

  const toggleNotify = async (v: boolean) => {
    if (!v) return setNotify(false);
    if (typeof Notification === "undefined") return toast.error("This browser doesn't support notifications.");
    const p = await Notification.requestPermission();
    if (p === "granted") setNotify(true); else toast.error("Notification permission was not granted.");
  };

  return (
    <>
      <PageHeader title="Settings" subtitle="Your account settings. Data is saved to your account." />
      <form className="panel grid max-w-xl gap-6 p-6" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <div className="grid gap-1.5"><Label htmlFor="name">Display name</Label><Input id="name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} /></div>
        <div className="grid gap-3">
          <Label>Reminder intervals</Label>
          {OPTIONS.map((o) => (
            <label key={o.v} className="flex items-center gap-3 text-sm">
              <Checkbox checked={intervals.includes(o.v)} onCheckedChange={(c) => setIntervals((p) => (c ? [...p, o.v] : p.filter((x) => x !== o.v)))} />{o.l}
            </label>
          ))}
        </div>
        <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
          <div><p className="text-sm font-medium">Browser notifications</p><p className="text-xs text-muted-foreground">Shown while the site is open. No emails or SMS are sent.</p></div>
          <Switch checked={notify} onCheckedChange={toggleNotify} />
        </div>
        <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save settings"}</Button>
      </form>
    </>
  );
}
