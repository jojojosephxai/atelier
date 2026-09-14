import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ExtraFormDialog } from "@/components/forms";
import { ExtraCard } from "@/components/piece-card";
import { Button } from "@/components/ui/button";
import { preloadCutter } from "@/lib/cutout";
import { useWardrobe } from "@/lib/store";
import type { Extra, SkincareSlot } from "@/lib/types";
import { cn } from "@/lib/utils";

type When = "both" | "day" | "night";

export const Route = createFileRoute("/grooming")({
  validateSearch: (search: Record<string, unknown>): { when: When } => ({
    when:
      search.when === "day" || search.when === "night" || search.when === "both"
        ? search.when
        : "both",
  }),
  component: GroomingPage,
});

function slotOf(e: Extra): SkincareSlot {
  if (e.slot === "am" || e.slot === "pm" || e.slot === "both") return e.slot;
  const t = `${e.name} ${e.notes}`.toLowerCase();
  if (/\b(retinol|night cream|evening|\bpm\b)/.test(t)) return "pm";
  if (/\b(spf|vitamin c|morning|\bam\b)/.test(t)) return "am";
  return "both";
}

function byStep(list: Extra[]) {
  return [...list].sort((a, b) => (a.step ?? 99) - (b.step ?? 99));
}

function GroomingPage() {
  const extras = useWardrobe((s) => s.extras);
  const addExtra = useWardrobe((s) => s.addExtra);
  const updateExtra = useWardrobe((s) => s.updateExtra);
  const removeExtra = useWardrobe((s) => s.removeExtra);
  const { when } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Extra | null>(null);

  useEffect(() => {
    void preloadCutter();
  }, []);

  const { day, night, both, bottles } = useMemo(() => {
    const skin = extras.filter((e) => e.kind === "skincare");
    return {
      both: byStep(skin),
      day: byStep(skin.filter((e) => slotOf(e) !== "pm")),
      night: byStep(skin.filter((e) => slotOf(e) !== "am")),
      bottles: extras.filter((e) => e.kind !== "skincare"),
    };
  }, [extras]);

  const skinList =
    when === "day" ? day : when === "night" ? night : both;
  const hasSkin = skinList.length > 0;
  const empty = !hasSkin && !bottles.length;

  function toneFor(e: Extra): "day" | "night" {
    return slotOf(e) === "pm" ? "night" : "day";
  }

  function openNew() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(e: Extra) {
    setEditing(e);
    setOpen(true);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="hidden text-xs tracking-[0.2em] text-muted uppercase sm:block">
            Finishing
          </p>
          <h1 className="font-display text-3xl leading-none text-fg sm:text-4xl md:text-5xl">
            Grooming
          </h1>
          <p className="mt-1 max-w-md text-sm leading-relaxed text-muted">
            Day and night, in order. Same tiles as the closet — not a store.
          </p>
          <div className="relative z-20 mt-4 flex flex-wrap gap-2">
            {(["both", "day", "night"] as const).map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={when === id}
                onClick={() =>
                  void navigate({
                    search: { when: id },
                    replace: true,
                  })
                }
                className={cn(
                  "h-11 rounded-full px-5 text-sm",
                  when === id
                    ? "bg-accent text-accent-fg"
                    : "bg-raised text-muted",
                )}
              >
                {id === "both" ? "Both" : id === "day" ? "Day" : "Night"}
              </button>
            ))}
          </div>
        </div>
        <Button onClick={openNew}>
          <Plus className="size-4" />
          Add piece
        </Button>
      </header>

      {empty ? <p className="text-sm text-muted">No steps yet.</p> : null}

      {hasSkin ? (
        <section>
          {when !== "both" ? (
            <h2 className="font-display text-3xl leading-none text-fg italic">
              {when === "day" ? "Day" : "Night"}
            </h2>
          ) : null}
          <div className={cn("groom-grid", when !== "both" && "mt-3")}>
            {skinList.map((e, i) => (
              <ExtraCard
                key={`${when}-${e.id}`}
                extra={e}
                tone={toneFor(e)}
                eager={i < 4}
                onClick={() => openEdit(e)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {bottles.length ? (
        <section>
          <h2 className="font-display text-3xl leading-none text-fg italic">
            Bottles
          </h2>
          <div className="groom-grid mt-3">
            {bottles.map((e, i) => (
              <ExtraCard
                key={`bot-${e.id}`}
                extra={e}
                eager={i < 4}
                onClick={() => openEdit(e)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {open ? (
        <ExtraFormDialog
          key={editing?.id ?? "new"}
          open={open}
          onOpenChange={setOpen}
          initial={editing}
          onSave={(data) => {
            if (editing) {
              updateExtra(editing.id, data);
              toast("Piece updated");
            } else {
              addExtra(data);
              toast("Piece added");
            }
          }}
          onDelete={
            editing
              ? () => {
                  removeExtra(editing.id);
                  setOpen(false);
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}
