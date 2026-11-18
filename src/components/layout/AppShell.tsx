"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Cpu,
  ShieldCheck,
  Bot,
  AlertTriangle,
  TrendingUp,
  FolderCheck,
  History,
  Settings,
  Info,
  Sun,
  Moon,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { cn, formatEnumLabel } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface ShellUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

const NAV_ITEMS = [
  { href: "/", label: "Executive Dashboard", icon: LayoutDashboard },
  { href: "/assets", label: "AI Asset Register", icon: Cpu },
  { href: "/frame", label: "FRAME Governance", icon: ShieldCheck },
  { href: "/aaef", label: "AAEF Appraisals", icon: Bot },
  { href: "/risks", label: "Risk & Controls", icon: AlertTriangle },
  { href: "/roi", label: "ROI & Value", icon: TrendingUp },
  { href: "/evidence", label: "Evidence & Actions", icon: FolderCheck },
  { href: "/audit", label: "Audit Log", icon: History, roles: ["ADMIN", "GOVERNANCE_OFFICE", "AUDITOR"] },
  { href: "/admin", label: "Admin Config", icon: Settings, roles: ["ADMIN", "GOVERNANCE_OFFICE"] },
  { href: "/about", label: "About & Frameworks", icon: Info },
];

export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [dark, setDark] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("aegisx_theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = saved ? saved === "dark" : prefersDark;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("aegisx_theme", next ? "dark" : "light");
  }

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const visibleNav = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(user.role));

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col border-r border-border bg-surface shrink-0">
        <div className="h-16 flex items-center px-3 border-b border-border">
          <Link
            href="/"
            className="w-full rounded-md bg-white px-3 py-1.5 flex items-center justify-center border border-border/60"
          >
            <img
              src="/aegis-logo.png"
              alt="Aegis AI Governance Platform"
              className="h-9 w-auto object-contain"
            />
          </Link>
        </div>

        <nav aria-label="Primary navigation" className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border text-[11px] text-muted-foreground leading-relaxed">
          FRAME and AAEF by Ian Loe, Tactics Solutions, licensed CC BY-NC 4.0.
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-surface border-r border-border flex flex-col z-10">
            <div className="h-16 flex items-center justify-between gap-2 px-3 border-b border-border">
              <div className="rounded-md bg-white px-2.5 py-1 flex items-center border border-border/60">
                <img
                  src="/aegis-logo.png"
                  alt="Aegis AI Governance Platform"
                  className="h-8 w-auto object-contain"
                />
              </div>
              <button
                type="button"
                aria-label="Close navigation menu"
                onClick={() => setMobileOpen(false)}
                className="p-1 rounded hover:bg-surface-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav aria-label="Mobile navigation" className="flex-1 p-3 space-y-1 overflow-y-auto">
              {visibleNav.map((item) => {
                const Icon = item.icon;
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-surface px-4 lg:px-6 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation menu"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-1.5 rounded border border-border hover:bg-surface-muted"
            >
              <Menu className="h-4 w-4" />
            </button>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              FRAME Governance Envelope &amp; AAEF Agent Evaluation
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <span className="font-medium text-foreground">{user.name}</span>
              <Badge variant="outline">{formatEnumLabel(user.role)}</Badge>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
              title={dark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Sign out</span>
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">{children}</main>

        <footer className="border-t border-border bg-surface px-4 lg:px-6 py-3 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
          <span>Aegis: AI Governance Platform</span>
          <span>FRAME and AAEF by Ian Loe, Tactics Solutions, licensed CC BY-NC 4.0.</span>
        </footer>
      </div>
    </div>
  );
}
