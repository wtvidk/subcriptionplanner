import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { LogOut, Bell, CalendarClock, CreditCard, History, LayoutDashboard, Menu, PieChart, Search, Settings, Shapes, X } from "lucide-react";
import { getReminders } from "@/lib/planner.functions";
import { QK } from "@/lib/format";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/browse", label: "Browse Services", icon: Search },
  { to: "/subscriptions", label: "My Subscriptions", icon: CreditCard },
  { to: "/categories", label: "Categories", icon: Shapes },
  { to: "/reminders", label: "Renewal Reminders", icon: CalendarClock },
  { to: "/expenses", label: "Expense Summary", icon: PieChart },
  { to: "/history", label: "Cancelled History", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function NavLinks({ unread, onNav }: { unread: number; onNav?: () => void }) {
  const { pathname } = useLocation();
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon }) => {
        const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
        return (
          <Link key={to} to={to} onClick={onNav}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${active ? "bg-secondary font-medium text-secondary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
            <Icon className={`h-4 w-4 ${active ? "text-primary" : ""}`} />
            <span className="flex-1">{label}</span>
            {to === "/reminders" && unread > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">{unread}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function SignOut() {
  const qc = useQueryClient(); const navigate = useNavigate();
  return (
    <button onClick={async () => { await qc.cancelQueries(); qc.clear(); await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); }}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
      <LogOut className="h-4 w-4" />Sign out
    </button>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { data } = useQuery({ queryKey: [...QK.all, "reminders"], queryFn: () => getReminders() });
  const unread = data?.reminders.filter((r) => !r.read).length ?? 0;

  // Optional browser notifications for unread reminders (once per session per reminder).
  const notified = useRef(new Set<string>());
  useEffect(() => {
    if (!data?.settings.browser_notifications || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    for (const r of data.reminders) {
      if (r.read || notified.current.has(r.key) || sessionStorage.getItem("n:" + r.key)) continue;
      notified.current.add(r.key); sessionStorage.setItem("n:" + r.key, "1");
      new Notification(`${r.sub.service_name} renews ${r.days === 0 ? "today" : `in ${r.days} day${r.days === 1 ? "" : "s"}`}`, { body: `${r.sub.plan_name} · ₹${r.sub.price}` });
    }
  }, [data]);

  const Brand = (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary"><CreditCard className="h-4 w-4" /></span>
      <span className="font-display text-lg font-semibold">Subscription Planner</span>
    </Link>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col gap-8 border-r border-border bg-sidebar p-5 lg:flex">
        {Brand}
        <NavLinks unread={unread} />
        <div className="mt-auto"><SignOut /><p className="mt-2 px-3 text-xs text-muted-foreground">Prices in ₹ · tracking only</p></div>
      </aside>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card/90 px-4 py-3 backdrop-blur lg:hidden">
        {Brand}
        <div className="flex items-center gap-1">
          <Link to="/reminders" className="relative rounded-lg p-2 text-muted-foreground" aria-label="Reminders">
            <Bell className="h-5 w-5" />
            {unread > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary" />}
          </Link>
          <button onClick={() => setOpen(true)} className="rounded-lg p-2" aria-label="Open menu"><Menu className="h-5 w-5" /></button>
        </div>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-foreground/20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-72 bg-card p-5 shadow-xl">
            <div className="mb-6 flex justify-end"><button onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button></div>
            <NavLinks unread={unread} onNav={() => setOpen(false)} />
            <div className="mt-4 border-t border-border pt-4"><SignOut /></div>
          </div>
        </div>
      )}
      <main className="px-4 py-6 sm:px-8 lg:ml-64 lg:py-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Empty({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="panel flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary"><CreditCard className="h-5 w-5" /></div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{text}</p>
      {action}
    </div>
  );
}

export function AutopayBadge({ on }: { on: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs ${on ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-success" : "bg-muted-foreground/50"}`} />Autopay {on ? "ON" : "OFF"}
    </span>
  );
}
