import { createFileRoute } from "@tanstack/react-router";
import { addDays, format, startOfToday } from "date-fns";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { LookBuilderDialog } from "@/components/look-builder";
import { LookBoard } from "@/components/look-board";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/field";
import { currentSeason } from "@/lib/routines";
import { useWardrobe } from "@/lib/store";
import { composeWithGrok, toStylistPayload } from "@/lib/stylist";
import { formatDay, todayISO } from "@/lib/utils";

export const Route = createFileRoute("/looks")({ component: LooksPage });

function LooksPage() {
  const {
    looks,
    garments,
    extras,
    profile,
    updateLook,
    removeLook,
    wearToday,
    addLook,
  } = useWardrobe();
  const [focus, setFocus] = useState<string | "all">("all");
  const [build, setBuild] = useState(false);
  const [busy, setBusy] = useState(false);

  const days = useMemo(() => {
    const start = startOfToday();
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i);
      return format(d, "yyyy-MM-dd");
    });
  }, []);

  const visible = looks.filter((l) =>
    focus === "all" ? true : l.plannedDate === focus,
  );

  async function consultGrok() {
    if (garments.length < 3) {
      toast.error("Add a few more pieces before asking Grok.");
      return;
    }
    setBusy(true);
    try {
      const payload = toStylistPayload(
        garments,
        extras,
        {
          description:
            "Three distinct outfits from this closet for today. Vary the jackets and bases. Clothes only.",
          climate: profile.defaultClimate,
          occasion: "smart-casual",
          season: currentSeason(),
        },
        profile.styleNotes,
      );
      const res = await composeWithGrok({ data: payload });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      let added = 0;
      for (const look of res.looks) {
        addLook({
          name: look.name,
          garmentIds: look.garmentIds,
          extraIds: [],
          occasion: look.name,
          notes: look.rationale,
          source: "stylist",
        });
        added += 1;
      }
      toast(
        added
          ? `Grok sent ${added} look${added === 1 ? "" : "s"}`
          : "Grok sent looks you already have",
      );
    } catch {
      toast.error("Grok could not be reached.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs tracking-[0.2em] text-muted uppercase">Planner</p>
          <h1 className="font-display text-4xl leading-none text-fg md:text-5xl">
            Looks
          </h1>
          <p className="mt-2 text-sm text-muted">
            Saved outfits. Consult Grok for three new ones from this closet.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => void consultGrok()}
          >
            {busy ? "Consulting Grok…" : "Consult Grok"}
          </Button>
          <Button onClick={() => setBuild(true)}>
            <Plus className="size-4" />
            Build a look
          </Button>
        </div>
      </header>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <button
          type="button"
          onClick={() => setFocus("all")}
          className={`h-16 min-w-16 shrink-0 rounded-lg px-3 text-left text-xs ${
            focus === "all"
              ? "bg-accent text-accent-fg"
              : "bg-raised text-muted shadow-[var(--shadow-border)]"
          }`}
        >
          <div className="text-[10px] tracking-wide uppercase">All</div>
          <div className="mt-1 font-medium tabular-nums">{looks.length}</div>
        </button>
        {days.map((iso) => {
          const count = looks.filter((l) => l.plannedDate === iso).length;
          const active = focus === iso;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => setFocus(iso)}
              className={`h-16 min-w-20 shrink-0 rounded-lg px-3 text-left ${
                active
                  ? "bg-accent text-accent-fg"
                  : "bg-raised text-muted shadow-[var(--shadow-border)]"
              }`}
            >
              <div className="text-[10px] tracking-wide uppercase">
                {iso === todayISO() ? "Today" : formatDay(iso).split(",")[0]}
              </div>
              <div className="mt-1 text-sm font-medium">
                {formatDay(iso).split(",")[1]?.trim() ?? iso}
              </div>
              {count ? (
                <div className="text-[10px] tabular-nums opacity-70">
                  {count} look{count === 1 ? "" : "s"}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl bg-surface px-6 py-16 text-center shadow-[var(--shadow-border)]">
          <p className="font-display text-3xl text-fg">No looks yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            Build one from the closet, or let Grok compose three.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void consultGrok()}
            >
              {busy ? "Consulting Grok…" : "Consult Grok"}
            </Button>
            <Button onClick={() => setBuild(true)}>Build a look</Button>
          </div>
        </div>
      ) : (
        <div className="looks-cols looks-planner">
          {visible.map((look) => (
            <LookBoard
              key={look.id}
              name={look.name}
              garmentIds={look.garmentIds}
              extraIds={look.extraIds}
              rationale={look.notes}
              occasion={look.occasion}
              source={look.source}
              garments={garments}
              extras={extras}
              lookId={look.id}
              photoDataUrl={look.photoDataUrl}
              actions={
                <>
                  <Button
                    onClick={() => {
                      wearToday({
                        id: look.id,
                        name: look.name,
                        garmentIds: look.garmentIds,
                        extraIds: look.extraIds,
                        occasion: look.occasion,
                        notes: look.notes,
                        source: look.source,
                        photoDataUrl: look.photoDataUrl,
                      });
                      toast("That's today's look");
                    }}
                  >
                    Wear today
                  </Button>
                  <NativeSelect
                    className="look-card-schedule"
                    value={look.plannedDate ?? ""}
                    onChange={(e) =>
                      updateLook(look.id, {
                        plannedDate: e.target.value || undefined,
                      })
                    }
                  >
                    <option value="">Unscheduled</option>
                    {days.map((iso) => (
                      <option key={iso} value={iso}>
                        {iso === todayISO() ? "Today" : formatDay(iso)}
                      </option>
                    ))}
                  </NativeSelect>
                  <Button
                    variant="danger"
                    onClick={() => removeLook(look.id)}
                  >
                    Remove
                  </Button>
                </>
              }
            />
          ))}
        </div>
      )}

      {build ? (
        <LookBuilderDialog open={build} onOpenChange={setBuild} />
      ) : null}
    </div>
  );
}
