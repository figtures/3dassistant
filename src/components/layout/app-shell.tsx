"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/logo";
import {
  LayoutDashboard,
  CalendarDays,
  Calendar,
  Package,
  Users,
  Cpu,
  LogOut,
  Menu,
  X,
  AlertTriangle,
  ShoppingCart,
  LayoutGrid,
  CreditCard,
  LifeBuoy,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SupportReportButton } from "@/components/support/report-problem-modal";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/planning", label: "Planlama", icon: CalendarDays },
  { href: "/calendar", label: "Teslim Takvimi", icon: Calendar },
  { href: "/materials", label: "Malzemeler", icon: Package },
  { href: "/procurement", label: "Tedarik", icon: ShoppingCart },
  { href: "/catalog", label: "Katalog", icon: LayoutGrid },
  { href: "/customers", label: "Müşteriler", icon: Users },
  { href: "/machines", label: "Makineler", icon: Cpu },
  { href: "/faults", label: "Arızalar", icon: AlertTriangle },
  { href: "/billing", label: "Abonelik", icon: CreditCard },
  { href: "/support", label: "Destek", icon: LifeBuoy },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex h-screen overflow-hidden app-bg">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen w-[260px] shrink-0 flex-col border-r border-zinc-800/80 bg-zinc-950/90 backdrop-blur-xl transition-transform duration-300 ease-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-zinc-800/80 px-5">
          <Logo size="sm" />
          <button
            className="flex h-11 w-11 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-800 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Menüyü kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
            Menü
          </p>
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-gradient-to-r from-sky-500/15 to-indigo-500/10 text-sky-400 ring-1 ring-sky-500/20"
                    : "text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-200"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 transition-colors",
                    active ? "text-sky-400" : "text-zinc-600 group-hover:text-zinc-400"
                  )}
                  strokeWidth={active ? 2.5 : 2}
                />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-zinc-800/80 p-3 space-y-1">
          <SupportReportButton className="w-full justify-start gap-3 rounded-xl text-zinc-500 lg:hidden" />
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 rounded-xl text-zinc-500 hover:text-zinc-300"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Çıkış Yap
          </Button>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:ml-[260px]">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-4 border-b border-zinc-800/60 bg-zinc-950/70 px-4 backdrop-blur-xl lg:px-6">
          <button
            className="flex h-11 w-11 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300 lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Menüyü aç"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden lg:block">
            <Logo size="sm" showText={false} />
          </div>
          <div className="flex-1" />
          <SupportReportButton className="inline-flex gap-2 text-zinc-400" />
        </header>
        <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
