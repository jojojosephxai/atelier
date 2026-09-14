import type { ReactNode } from "react";
import { memo, useEffect, useState } from "react";
import { ImagePlus, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { toast } from "sonner";
import { LookGrid } from "@/components/look-grid";
import { lookName } from "@/lib/board-set";
import { describeLook } from "@/lib/describe-look";
import { compressImage } from "@/lib/image";
import { lookCoreKey } from "@/lib/look";
import { votePolarity } from "@/lib/look-votes";
import { useWardrobe } from "@/lib/store";
import type { Extra, Garment, LookSource } from "@/lib/types";
import type { RoutineId } from "@/lib/routines";
import { cn } from "@/lib/utils";

function routineOf(text: string): RoutineId {
  const t = text.toLowerCase();
  if (/\b(gym|pe|athletic|workout|run)\b/.test(t)) return "gym";
  if (/\b(school|class|campus|hall)\b/.test(t)) return "school";
  if (/\b(out|dinner|date|evening|night)\b/.test(t)) return "out";
  return "weekend";
}

export const LookBoard = memo(function LookBoard({
  name,
  garmentIds,
  extraIds,
  rationale,
  climateNotes,
  incomplete,
  source,
  garments,
  extras,
  actions,
  compact,
  lookId,
  photoDataUrl,
  eager,
  occasion,
}: {
  name: string;
  garmentIds: string[];
  extraIds: string[];
  rationale?: string;
  climateNotes?: string;
  incomplete?: string[];
  source: LookSource;
  garments: Garment[];
  extras: Extra[];
  actions?: ReactNode;
  compact?: boolean;
  lookId?: string;
  photoDataUrl?: string;
  eager?: boolean;
  occasion?: string;
}) {
  void extraIds;
  void extras;
  void climateNotes;
  void compact;
  const updateLook = useWardrobe((s) => s.updateLook);
  const addLook = useWardrobe((s) => s.addLook);
  const setProfile = useWardrobe((s) => s.setProfile);
  const lookVotes = useWardrobe((s) => s.profile.lookVotes);
  const climate = useWardrobe((s) => s.profile.defaultClimate);
  const [photo, setPhoto] = useState(photoDataUrl);
  const [id, setId] = useState(lookId);
  useEffect(() => setPhoto(photoDataUrl), [photoDataUrl]);
  useEffect(() => setId(lookId), [lookId]);

  const pieces = garmentIds
    .map((gid) => garments.find((g) => g.id === gid))
    .filter((g): g is Garment => Boolean(g));

  async function onPick(file?: File) {
    if (!file) return;
    try {
      const data = await compressImage(file, 720);
      let nextId = id;
      if (!nextId) {
        nextId = addLook({
          name,
          garmentIds,
          extraIds: [],
          occasion: occasion || "",
          notes: rationale ?? "",
          source,
          photoDataUrl: data,
        });
        setId(nextId);
      } else {
        updateLook(nextId, { photoDataUrl: data });
      }
      setPhoto(data);
      toast("Photo added");
    } catch {
      toast("Could not read that photo");
    }
  }

  function clearPhoto() {
    if (id) updateLook(id, { photoDataUrl: undefined });
    setPhoto(undefined);
  }

  const voteKey = lookCoreKey(garmentIds, garments);
  const vote = votePolarity(lookVotes?.[voteKey]);
  const routine = routineOf(`${occasion} ${name} ${rationale}`);
  const title = name.trim() ? name : lookName(pieces, routine);
  const why = rationale?.trim()
    ? rationale.trim()
    : describeLook(pieces, { routine, climate }, garmentIds.join("").length % 4);

  function castVote(next: 1 | -1) {
    const cur = { ...(lookVotes ?? {}) };
    if (vote === next) delete cur[voteKey];
    else cur[voteKey] = next;
    setProfile({ lookVotes: cur });
  }

  return (
    <article className="look-card">
      <header className="look-card-head">
        <h3 className="look-card-title">{title}</h3>
        {why ? (
          <div className="why-band">
            <p className="why-paper">{why}</p>
          </div>
        ) : null}
      </header>

      {photo ? (
        <div className="look-card-photo">
          <img src={photo} alt="" decoding="async" />
          <button
            type="button"
            onClick={clearPhoto}
            aria-label="Remove photo"
            className="absolute top-2 right-2 flex size-11 items-center justify-center rounded-full bg-white/90 text-neutral-800 shadow-sm"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <LookGrid garments={pieces} eager={eager} />
      )}

      <footer className="look-card-actions">
        {incomplete && incomplete.length > 0 ? (
          <p className="w-full text-xs text-danger">{incomplete.join(" · ")}</p>
        ) : null}
        <div className="look-card-bar">
          <div className="look-card-votes">
            <button
              type="button"
              aria-label="Like this look"
              aria-pressed={vote === 1}
              onClick={() => castVote(1)}
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-full shadow-[var(--shadow-border)]",
                vote === 1
                  ? "bg-accent text-accent-fg"
                  : "text-muted hover:bg-raised",
              )}
            >
              <ThumbsUp className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label="Dislike this look"
              aria-pressed={vote === -1}
              onClick={() => castVote(-1)}
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-full shadow-[var(--shadow-border)]",
                vote === -1
                  ? "bg-accent text-accent-fg"
                  : "text-muted hover:bg-raised",
              )}
            >
              <ThumbsDown className="size-3.5" />
            </button>
          </div>
          {actions}
          {!photo ? (
            <label
              aria-label="Add photo"
              className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted shadow-[var(--shadow-border)]"
            >
              <ImagePlus className="size-3.5" />
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  void onPick(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          ) : null}
        </div>
      </footer>
    </article>
  );
});
