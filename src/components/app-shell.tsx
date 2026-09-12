import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  Droplet,
  Layers,
  Moon,
  MoreHorizontal,
  Shirt,
  Sun,
  SwatchBook,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { IntroDialog } from "@/components/intro-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useHydrated, useWardrobe } from "@/lib/store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Today", icon: CalendarDays },
  { to: "/closet", label: "Closet", icon: Shirt },
  { to: "/looks", label: "Looks", icon: Layers },
  { to: "/stylist", label: "Stylist", icon: SwatchBook },
  { to: "/grooming", label: "Grooming", icon: Droplet },
] as const;

function HangerMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden>
      <circle cx="18.3" cy="7.2" r="1.85" fill="currentColor" />
      <path
        d="M16 8.8 V12.4 M6.6 21.8 L16 12.4 L25.4 21.8 M8.2 21.8 H23.8"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function applyTheme(theme: "dark" | "light") {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const hydrated = useHydrated();
  const profile = useWardrobe((s) => s.profile);
  const loadSample = useWardrobe((s) => s.loadSample);
  const clearAll = useWardrobe((s) => s.clearAll);
  const setProfile = useWardrobe((s) => s.setProfile);
  const isHome = pathname === "/";
  const isGrooming = pathname === "/grooming" || pathname.startsWith("/grooming/");

  useEffect(() => {
    applyTheme(profile.theme === "dark" ? "dark" : "light");
  }, [profile.theme]);

  const light = profile.theme === "light";

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <header className="sticky top-0 z-40 border-b border-border bg-bg/95">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <Link to="/" className="flex items-center gap-2 text-fg">
            <HangerMark className="size-7" />
            <span className="font-display text-xl tracking-tight italic">
              Atelier
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active =
                item.to === "/"
                  ? pathname === "/"
                  : pathname === item.to || pathname.startsWith(`${item.to}/`);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "inline-flex h-11 items-center gap-2 rounded-md px-3 text-sm transition-colors duration-150",
                    active ? "text-fg" : "text-muted hover:text-fg",
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={light ? "Switch to dark" : "Switch to light"}
              onClick={() => setProfile({ theme: light ? "dark" : "light" })}
            >
              {light ? <Moon className="size-4" /> : <Sun className="size-4" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Menu">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => {
                    void navigate({ to: "/settings" });
                  }}
                >
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!hydrated}
                  onSelect={() => {
                    loadSample();
                    toast("Sample closet loaded");
                  }}
                >
                  Load sample closet
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!hydrated}
                  className="text-danger"
                  onSelect={() => {
                    clearAll();
                    toast("Closet cleared");
                  }}
                >
                  Clear everything
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main
        className={cn(
          "mx-auto w-full flex-1",
          isHome
            ? "max-w-none px-0 pt-0 pb-24 md:pb-10"
            : isGrooming
              ? "max-w-6xl px-4 pt-6 pb-24 md:max-w-[88rem] md:px-6 md:pb-10"
              : "max-w-6xl px-4 pt-6 pb-24 md:pb-10",
        )}
      >
        {hydrated || isHome ? children : <ShellSkeleton />}
      </main>
      {hydrated ? <IntroDialog /> : null}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/95 md:hidden">
        <div className="mx-auto grid max-w-6xl grid-cols-5 px-1 pb-[env(safe-area-inset-bottom)]">
          {NAV.map((item) => {
            const active =
              item.to === "/"
                ? pathname === "/"
                : pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] tracking-wide",
                  active ? "text-fg" : "text-muted",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="space-y-4 px-4 pt-6">
      <div className="h-10 w-48 rounded-md bg-raised" />
      <div className="h-5 w-72 rounded-md bg-raised" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-[3/4] rounded-xl bg-raised" />
        ))}
      </div>
    </div>
  );
}
