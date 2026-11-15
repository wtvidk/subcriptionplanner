import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { AlertTriangle, ImageUp, Loader2, RefreshCw, ScanLine, X } from "lucide-react";
import { scanSubscription, type ScanResult } from "@/lib/scan.functions";
import { SERVICES, categoryName } from "@/lib/catalogue";
import { PageHeader } from "@/components/AppShell";
import { SubscriptionDialog, type DialogTarget } from "@/components/SubscriptionDialog";
import { Button } from "@/components/ui/button";
import { dateLabel, inr } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/scan")({
  head: () => ({ meta: [
    { title: "Scan Subscription — Subscription Planner" },
    { name: "description", content: "Upload a screenshot or invoice and let AI fill in your subscription details." },
    { property: "og:title", content: "Scan Subscription — Subscription Planner" },
    { property: "og:description", content: "Upload a screenshot or invoice and let AI fill in your subscription details." },
  ] }),
  component: ScanPage,
});

const TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX = 10 * 1024 * 1024;

/** Downscale to max 1600px and re-encode as JPEG so uploads stay small. */
function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const ctx = c.getContext("2d"); if (!ctx) return reject(new Error("Could not read image"));
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); resolve(c.toDataURL("image/jpeg", 0.88));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("This image couldn't be opened.")); };
    img.src = url;
  });
}

function ScanPage() {
  const input = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [choice, setChoice] = useState<string>("");
  const [dlg, setDlg] = useState<DialogTarget | null>(null);
  const scan = useMutation({ mutationFn: (img: string) => scanSubscription({ data: { image: img } }),
    onSuccess: (r: ScanResult) => setChoice(r.matches[0] && r.matches[0].score >= 0.6 ? r.matches[0].serviceId : "") });

  const pick = async (f: File | undefined) => {
    setFileError(null); scan.reset();
    if (!f) return;
    if (!TYPES.includes(f.type)) return setFileError("Unsupported file. Please use PNG, JPG, WEBP or GIF.");
    if (f.size > MAX) return setFileError("That file is over 10 MB. Please use a smaller image.");
    try { setImage(await toDataUrl(f)); } catch (e) { setFileError((e as Error).message); }
  };
  const clear = () => { setImage(null); scan.reset(); setFileError(null); if (input.current) input.current.value = ""; };

  const r = scan.data; const e = r?.extract;
  const confirm = () => {
    if (!e) return;
    const svc = SERVICES.find((s) => s.id === choice);
    const m = r!.matches.find((x) => x.serviceId === choice);
    const noteBits = [e.currency && e.currency !== "INR" && e.price != null ? `Scanned price: ${e.price} ${e.currency}` : null, e.notes].filter(Boolean);
    setDlg({ mode: "add", ...(svc ? { service: svc, planId: m?.planId ?? "__none" } : {}), prefill: {
      ...(e.service_name ? { serviceName: e.service_name } : {}),
      ...(r!.categoryId ? { category: categoryName(r!.categoryId) } : {}),
      ...(e.plan_name ? { planName: e.plan_name } : {}),
      ...(e.price != null ? { price: e.price } : {}), ...(e.billing ? { interval: e.billing } : {}),
      ...(e.renewal_date ? { renewal: e.renewal_date } : {}), ...(noteBits.length ? { notes: noteBits.join(" · ") } : {}),
    } });
  };

  return (
    <>
      <PageHeader title="Scan Subscription" subtitle="Upload a screenshot, invoice or confirmation page. Nothing is added until you confirm."
        action={<Button variant="outline" onClick={() => setDlg({ mode: "add" })}>Add manually</Button>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel p-6">
          {!image ? (
            <div onDragOver={(ev) => { ev.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
              onDrop={(ev) => { ev.preventDefault(); setDrag(false); pick(ev.dataTransfer.files[0]); }}
              onClick={() => input.current?.click()} role="button" tabIndex={0} aria-label="Upload image"
              className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-16 text-center transition-colors ${drag ? "border-primary bg-secondary" : "border-border hover:border-primary-soft hover:bg-muted"}`}>
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary"><ImageUp className="h-5 w-5" /></span>
              <p className="font-medium">Drop an image here or click to choose</p>
              <p className="text-xs text-muted-foreground">PNG, JPG, WEBP or GIF · up to 10 MB</p>
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="relative overflow-hidden rounded-2xl border border-border bg-muted">
                <img src={image} alt="Uploaded subscription" className="max-h-[420px] w-full object-contain" />
                {scan.isPending && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-card/70 backdrop-blur-sm"><Loader2 className="h-6 w-6 animate-spin text-primary" /><p className="text-sm">Reading your subscription…</p></div>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => scan.mutate(image)} disabled={scan.isPending}><ScanLine className="h-4 w-4" />{scan.isSuccess ? "Scan again" : "Scan image"}</Button>
                <Button variant="outline" onClick={() => input.current?.click()} disabled={scan.isPending}><RefreshCw className="h-4 w-4" />Replace</Button>
                <Button variant="ghost" onClick={clear} disabled={scan.isPending}><X className="h-4 w-4" />Remove</Button>
              </div>
            </div>
          )}
          <input ref={input} type="file" accept={TYPES.join(",")} className="hidden" onChange={(ev) => pick(ev.target.files?.[0])} />
          {fileError && <p className="mt-3 text-sm text-destructive">{fileError}</p>}
        </section>

        <section className="panel p-6">
          <h2 className="mb-4 text-xl font-semibold">Results</h2>
          {scan.isError ? (
            <div className="grid gap-3"><p className="text-sm text-destructive">{(scan.error as Error).message}</p>
              <div className="flex gap-2"><Button onClick={() => image && scan.mutate(image)}>Retry</Button><Button variant="outline" onClick={() => setDlg({ mode: "add" })}>Add manually</Button></div></div>
          ) : !e ? (
            <p className="text-sm text-muted-foreground">{scan.isPending ? "Scanning…" : "Upload an image and press Scan to see the details here."}</p>
          ) : !e.readable ? (
            <div className="grid gap-3"><p className="text-sm">We couldn't find subscription details in this image. Try a clearer screenshot, or add it manually.</p>
              <Button variant="outline" className="w-fit" onClick={() => setDlg({ mode: "add" })}>Add manually</Button></div>
          ) : (
            <div className="grid gap-5">
              {r!.duplicateOf && <p className="flex items-start gap-2 rounded-xl bg-secondary p-3 text-sm text-secondary-foreground"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />You may already track this: {r!.duplicateOf}.</p>}
              <dl className="grid grid-cols-2 gap-y-2 rounded-xl bg-muted p-4 text-sm">
                {([["Service", e.service_name], ["Plan", e.plan_name],
                  ["Price", e.price != null ? (e.currency && e.currency !== "INR" ? `${e.price} ${e.currency}` : inr(e.price)) : null],
                  ["Billing", e.billing], ["Renewal", e.renewal_date ? dateLabel(e.renewal_date) : null],
                  ["Category", r!.categoryId ? categoryName(r!.categoryId) : null]] as [string, string | null][]).map(([k, v]) => (
                  <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className={`text-right ${v ? "font-medium" : "text-muted-foreground"}`}>{v ?? "Not found"}</dd></div>
                ))}
              </dl>
              {e.notes && <p className="text-xs text-muted-foreground">Note: {e.notes}</p>}
              <div className="grid gap-2">
                <p className="text-sm font-medium">Match in our catalogue</p>
                {r!.matches.length === 0 && <p className="text-xs text-muted-foreground">No close match — it will be added as a custom service.</p>}
                {r!.matches.map((m) => (
                  <label key={m.serviceId} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${choice === m.serviceId ? "border-primary bg-secondary" : "border-border"}`}>
                    <input type="radio" name="match" className="accent-[var(--primary)]" checked={choice === m.serviceId} onChange={() => setChoice(m.serviceId)} />
                    <span className="flex-1">{m.name}{m.planName && <span className="text-muted-foreground"> · {m.planName}</span>}</span>
                    <span className="text-xs text-muted-foreground">{m.exact ? "Exact match" : `Estimate · ${Math.round(m.score * 100)}%`}</span>
                  </label>
                ))}
                <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${choice === "" ? "border-primary bg-secondary" : "border-border"}`}>
                  <input type="radio" name="match" className="accent-[var(--primary)]" checked={choice === ""} onChange={() => setChoice("")} />
                  <span className="flex-1">None of these — use as custom service</span>
                </label>
              </div>
              <Button onClick={confirm}>Review &amp; edit details</Button>
            </div>
          )}
        </section>
      </div>
      <SubscriptionDialog target={dlg} onClose={() => setDlg(null)} />
    </>
  );
}
