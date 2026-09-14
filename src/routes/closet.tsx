import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { GarmentFormDialog } from "@/components/forms";
import { GarmentCard } from "@/components/piece-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { lookEligible } from "@/lib/board-set";
import { preloadCutter } from "@/lib/cutout";
import { OPEN_ADD_KEY } from "@/components/intro-dialog";
import { useWardrobe } from "@/lib/store";
import type { Garment, GarmentCategory, SmartFilterId } from "@/lib/types";
import {
  CATEGORY_LABELS,
  GARMENT_CATEGORIES,
  SMART_FILTERS,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/closet")({ component: ClosetPage });

function ClosetPage() {
  const { garments, addGarment, updateGarment, removeGarment } = useWardrobe();
  const [query, setQuery] = useState("");
  const [smart, setSmart] = useState<SmartFilterId>("all");
  const [cat, setCat] = useState<GarmentCategory | "all">("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Garment | null>(null);

  useEffect(() => {
    void preloadCutter();
  }, []);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(OPEN_ADD_KEY) !== "1") return;
      sessionStorage.removeItem(OPEN_ADD_KEY);
    } catch {
      return;
    }
    setEditing(null);
    setOpen(true);
  }, []);

  const smartFn = SMART_FILTERS.find((f) => f.id === smart)?.test ?? (() => true);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return garments.filter((g) => {
      if (!smartFn(g)) return false;
      if (cat !== "all" && g.category !== cat) return false;
      if (!q) return true;
      return `${g.name} ${g.brand} ${g.colorName} ${g.material} ${g.notes} ${g.tags.join(" ")}`
        .toLowerCase()
        .includes(q);
    });
  }, [garments, cat, query, smartFn]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: garments.length };
    for (const c of GARMENT_CATEGORIES) {
      map[c] = garments.filter((g) => g.category === c).length;
    }
    for (const f of SMART_FILTERS) {
      map[f.id] = garments.filter(f.test).length;
    }
    return map;
  }, [garments]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs tracking-[0.2em] text-muted uppercase">
            Wardrobe
          </p>
          <h1 className="font-display text-4xl leading-none text-fg md:text-5xl">
            The closet
          </h1>
          <p className="mt-2 text-sm text-muted">
            {garments.length} pieces · collections sort from what you already entered
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="size-4" />
          Add piece
        </Button>
      </header>

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, brand, cloth, tag"
            className="pl-10"
          />
        </div>
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
          {SMART_FILTERS.map((f) => {
            const active = smart === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setSmart(f.id)}
                className={cn(
                  "h-10 shrink-0 rounded-full px-3 text-xs tracking-wide transition-colors duration-150",
                  active
                    ? "bg-accent text-accent-fg"
                    : "bg-raised text-muted shadow-[var(--shadow-border)]",
                )}
              >
                {f.label}
                <span className="ml-1.5 tabular-nums opacity-70">
                  {counts[f.id] ?? 0}
                </span>
              </button>
            );
          })}
        </div>
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
          {(["all", ...GARMENT_CATEGORIES] as const).map((c) => {
            const active = cat === c;
            const label = c === "all" ? "Category" : CATEGORY_LABELS[c];
            if (c === "all") {
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCat("all")}
                  className={cn(
                    "h-10 shrink-0 rounded-full px-3 text-xs tracking-wide",
                    active
                      ? "bg-accent text-accent-fg"
                      : "bg-raised text-muted shadow-[var(--shadow-border)]",
                  )}
                >
                  All types
                </button>
              );
            }
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCat(c)}
                className={cn(
                  "h-10 shrink-0 rounded-full px-3 text-xs tracking-wide transition-colors duration-150",
                  active
                    ? "bg-accent text-accent-fg"
                    : "bg-raised text-muted shadow-[var(--shadow-border)]",
                )}
              >
                {label}
                <span className="ml-1.5 tabular-nums opacity-70">
                  {counts[c] ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl bg-surface px-6 py-16 text-center shadow-[var(--shadow-border)]">
          <p className="font-display text-3xl text-fg">
            {garments.length === 0 ? "Empty rail" : "Nothing in this collection"}
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            {garments.length === 0
              ? "Add a coat, a pair of shoes, a shirt. Today builds looks from what you actually own."
              : "Try another collection, or clear search."}
          </p>
          {garments.length === 0 ? (
            <Button
              className="mt-5"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus className="size-4" />
              Add piece
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((g, i) => (
            <div
              key={g.id}
              className={cn("rise-in", i < 8 ? `rise-in-${(i % 4) + 1}` : "")}
            >
              <GarmentCard
                garment={g}
                onClick={() => {
                  setEditing(g);
                  setOpen(true);
                }}
              />
            </div>
          ))}
        </div>
      )}

      {open ? (
        <GarmentFormDialog
          key={editing?.id ?? "new"}
          open={open}
          onOpenChange={setOpen}
          initial={editing}
          onSave={(data) => {
            if (editing) {
              updateGarment(editing.id, data);
              toast(
                lookEligible({ ...editing, ...data })
                  ? "Piece updated"
                  : "Closet only — looks need formality, climate, and color",
              );
            } else {
              addGarment(data);
              toast(
                lookEligible({
                  ...data,
                  id: "new",
                  createdAt: 0,
                })
                  ? "Piece added"
                  : "Saved to Closet only — looks need formality, climate, and color",
              );
            }
          }}
          onDelete={
            editing
              ? () => {
                  removeGarment(editing.id);
                  setOpen(false);
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}
