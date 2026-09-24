import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { LookBoard } from "@/components/look-board";
import { Button } from "@/components/ui/button";
import { Field, NativeSelect, Textarea } from "@/components/ui/field";
import { composeLooks } from "@/lib/engine";
import { comboKey, likedGarmentIds, skippedLookKeys } from "@/lib/look";
import { ROUTINES, currentSeason, type RoutineId } from "@/lib/routines";
import { useWardrobe } from "@/lib/store";
import type {
  Brief,
  Climate,
  Formality,
  Season,
  SuggestedLook,
} from "@/lib/types";
import {
  CLIMATE_LABELS,
  CLIMATES,
  FORMALITIES,
  FORMALITY_LABELS,
  SEASON_LABELS,
  SEASONS,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/stylist")({ component: StylistPage });

function StylistPage() {
  const { garments, extras, looks, profile, setProfile, addLook, wearToday } =
    useWardrobe();
  const [description, setDescription] = useState(
    "Quiet office day, then a dinner that should not look like the office.",
  );
  const [climate, setClimate] = useState<Climate>(profile.defaultClimate);
  const [occasion, setOccasion] = useState<Formality>("smart-casual");
  const [season, setSeason] = useState<Season>(currentSeason());
  const [scene, setScene] = useState<RoutineId | null>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<SuggestedLook[]>([]);
  const [status, setStatus] = useState("");
  const runId = useRef(0);

  const brief: Brief = { description, climate, occasion, season };

  function compose(next?: Partial<Brief>) {
    if (garments.length < 3) {
      toast.error("Add a few more pieces before composing.");
      return;
    }
    const used: Brief = { ...brief, ...next };
    const id = ++runId.current;
    setBusy(true);
    setStatus("Reading the closet");

    const local = composeLooks(garments, extras, used, {
      likedIds: likedGarmentIds(profile.lookVotes),
      skipKeys: skippedLookKeys(profile.lookVotes),
    });
    if (id !== runId.current) return;
    setResults(local);
    setBusy(false);
    setStatus("");
  }

  function save(look: SuggestedLook, plan: boolean) {
    if (plan) {
      wearToday({
        name: look.name,
        garmentIds: look.garmentIds,
        extraIds: [],
        occasion: FORMALITY_LABELS[occasion],
        notes: look.rationale,
        source: look.source,
      });
      toast("That's today's look");
      return;
    }
    addLook({
      name: look.name,
      garmentIds: look.garmentIds,
      extraIds: [],
      occasion: FORMALITY_LABELS[occasion],
      notes: look.rationale,
      source: look.source,
    });
    toast("Look saved");
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs tracking-[0.2em] text-muted uppercase">
          Analyzer
        </p>
        <h1 className="font-display text-4xl leading-none text-fg md:text-5xl">
          Style analyzer
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Pick a scene for an instant set, or describe the day when you want
          something specific. Everything runs on this device from your closet —
          nothing is sent to a server.
        </p>
      </header>

      <section className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-6">
        <p className="text-xs tracking-[0.2em] text-muted uppercase">
          Instant scenes
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {ROUTINES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                setScene(r.id);
                setDescription(r.description);
                setOccasion(r.occasion);
                setSeason(currentSeason());
                compose({
                  description: r.description,
                  occasion: r.occasion,
                  season: currentSeason(),
                  climate,
                });
              }}
              className={cn(
                "h-11 rounded-md px-4 text-sm",
                scene === r.id
                  ? "bg-accent text-accent-fg"
                  : "bg-raised text-muted shadow-[var(--shadow-border)]",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        <Field label="Or describe it" className="mt-5">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Interview in the rain. Weekend market. Black-tie after a flight."
          />
        </Field>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Field label="Climate">
            <NativeSelect
              value={climate}
              onChange={(e) => {
                const v = e.target.value as Climate;
                setClimate(v);
                setProfile({ defaultClimate: v });
              }}
            >
              {CLIMATES.map((c) => (
                <option key={c} value={c}>
                  {CLIMATE_LABELS[c]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Circumstance">
            <NativeSelect
              value={occasion}
              onChange={(e) => setOccasion(e.target.value as Formality)}
            >
              {FORMALITIES.map((f) => (
                <option key={f} value={f}>
                  {FORMALITY_LABELS[f]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Season">
            <NativeSelect
              value={season}
              onChange={(e) => setSeason(e.target.value as Season)}
            >
              {SEASONS.map((s) => (
                <option key={s} value={s}>
                  {SEASON_LABELS[s]}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <Field label="How you like to dress" className="mt-4">
          <Textarea
            value={profile.styleNotes}
            onChange={(e) => setProfile({ styleNotes: e.target.value })}
            rows={2}
            placeholder="Quiet luxury. No logos. Brown shoes with navy. SPF always."
          />
        </Field>
        <div className="mt-5 flex justify-end">
          <Button onClick={() => compose()} disabled={busy}>
            {busy ? "Composing" : "Compose looks"}
          </Button>
        </div>
        {busy ? (
          <p className="shimmer mt-4 text-sm">{status || "Composing"}</p>
        ) : null}
      </section>

      {results.length ? (
        <section className="space-y-4">
          <h2 className="font-display text-3xl text-fg">Three looks</h2>
          <div className="looks-cols">
            {results.map((look) => {
              const saved = looks.find(
                (l) => comboKey(l.garmentIds) === comboKey(look.garmentIds),
              );
              return (
                <LookBoard
                  key={`${look.source}-${look.name}-${look.garmentIds.join("-")}`}
                  name={look.name}
                  garmentIds={look.garmentIds}
                  extraIds={look.extraIds}
                  rationale={look.rationale}
                  climateNotes={look.climateNotes}
                  incomplete={look.incomplete}
                  source={look.source}
                  garments={garments}
                  extras={extras}
                  occasion={`${occasion} ${description}`}
                  lookId={saved?.id}
                  photoDataUrl={saved?.photoDataUrl}
                  actions={
                    <>
                      <Button size="sm" onClick={() => save(look, false)}>
                        Save look
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => save(look, true)}
                      >
                        Wear today
                      </Button>
                    </>
                  }
                />
              );
            })}
          </div>
        </section>
      ) : (
        <p className="text-sm text-muted">
          Fill the brief, then Compose looks. Clothes and notes stay on this
          device — fragrance and skincare live under Grooming.
        </p>
      )}
    </div>
  );
}
