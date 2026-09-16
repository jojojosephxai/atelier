import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/field";
import { FASHION_PALETTE } from "@/lib/colors";
import {
  classifyCutError,
  cutBudget,
  cutFailCopy,
  cutGarment,
  cutProduct,
  tileBlobAfterCut,
  type CutMode,
} from "@/lib/cutout";
import { deletePhoto, putPhoto } from "@/lib/photo-db";
import { uid, cn } from "@/lib/utils";
import type {
  Climate,
  Extra,
  ExtraKind,
  Formality,
  FragranceFamily,
  Garment,
  GarmentCategory,
  Season,
  SkincareSlot,
} from "@/lib/types";
import {
  CATEGORY_LABELS,
  CLIMATE_LABELS,
  CLIMATES,
  EXTRA_KINDS,
  EXTRA_LABELS,
  FAMILY_LABELS,
  FORMALITIES,
  FORMALITY_LABELS,
  FRAGRANCE_FAMILIES,
  GARMENT_CATEGORIES,
  SEASON_LABELS,
  SEASONS,
  SKINCARE_SLOTS,
  SLOT_LABELS,
  SUGGESTED_TAGS,
} from "@/lib/types";

function ChipGroup<T extends string>({
  options,
  labels,
  value,
  onChange,
  multiple,
}: {
  options: readonly T[];
  labels: Record<T, string>;
  value: T | T[] | "";
  onChange: (next: T | T[]) => void;
  multiple?: boolean;
}) {
  const selected = new Set(
    Array.isArray(value) ? value : value ? [value] : [],
  );
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const on = selected.has(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => {
              if (multiple) {
                const next = new Set(selected);
                if (next.has(opt)) next.delete(opt);
                else next.add(opt);
                onChange([...next] as T[]);
              } else {
                onChange(opt);
              }
            }}
            className={cn(
              "h-9 rounded-full px-3 text-xs tracking-wide transition-colors duration-150",
              on
                ? "bg-accent text-accent-fg"
                : "bg-raised text-muted shadow-[var(--shadow-border)]",
            )}
          >
            {labels[opt]}
          </button>
        );
      })}
    </div>
  );
}

type CutJob = {
  ac: AbortController;
  stagingId?: string;
  putOk: boolean;
  floorUrl?: string;
};

/** Save the original photo first so the tile is never blank, then isolate. */
function useCuttablePhoto(initialBlobId?: string, initialSrc?: string) {
  const [imageBlobId, setImageBlobId] = useState(initialBlobId);
  const [preview, setPreview] = useState(initialSrc);
  const [cutting, setCutting] = useState(false);
  const [cutStatus, setCutStatus] = useState("");
  const photo = preview || initialSrc;
  const cutJob = useRef<CutJob | null>(null);
  const blobIdRef = useRef(imageBlobId);
  blobIdRef.current = imageBlobId;

  useEffect(() => {
    return () => abortCut(true);
  }, []);

  function abortCut(fromUnmount = false) {
    const job = cutJob.current;
    if (!job) return;
    job.ac.abort();
    if (job.floorUrl) URL.revokeObjectURL(job.floorUrl);
    if (job.stagingId && !job.putOk) void deletePhoto(job.stagingId);
    cutJob.current = null;
    if (!fromUnmount) setCutting(false);
  }

  async function pickPhoto(file: File, mode: CutMode) {
    abortCut();
    const ac = new AbortController();
    const job: CutJob = { ac, putOk: false };
    cutJob.current = job;
    const originalUrl = URL.createObjectURL(file);
    job.floorUrl = originalUrl;
    setPreview(originalUrl);
    setCutting(true);
    setCutStatus("Saving your photo…");

    const stillThisJob = () =>
      !ac.signal.aborted && cutJob.current === job;

    try {
      const originalId = uid("p");
      job.stagingId = originalId;
      await putPhoto(originalId, file);
      if (!stillThisJob()) {
        await deletePhoto(originalId);
        throw new DOMException("Aborted", "AbortError");
      }
      job.putOk = true;
      const prevId = blobIdRef.current;
      if (prevId && prevId !== originalId) void deletePhoto(prevId);
      setImageBlobId(originalId);

      const budget = cutBudget();
      if (!budget.ok) {
        setCutStatus(cutFailCopy("limit"));
        toast(cutFailCopy("limit"));
        return;
      }

      setCutStatus("Isolating from the floor…");
      const isolated =
        mode === "product"
          ? await cutProduct(file, setCutStatus, ac.signal)
          : await cutGarment(file, setCutStatus, ac.signal);
      if (!stillThisJob()) {
        throw new DOMException("Aborted", "AbortError");
      }
      const chosen = tileBlobAfterCut(file, isolated);
      if (chosen !== isolated) {
        setCutStatus(cutFailCopy("fail"));
        toast(cutFailCopy("fail"));
        return;
      }

      const cutId = uid("p");
      await putPhoto(cutId, isolated);
      if (!stillThisJob()) {
        await deletePhoto(cutId);
        throw new DOMException("Aborted", "AbortError");
      }
      void deletePhoto(originalId);
      job.stagingId = cutId;
      setImageBlobId(cutId);
      URL.revokeObjectURL(originalUrl);
      const cutUrl = URL.createObjectURL(isolated);
      job.floorUrl = cutUrl;
      setPreview(cutUrl);
      setCutStatus("Isolated cut saved");
    } catch (err) {
      if (cutJob.current !== job) return;
      const kind = classifyCutError(err);
      if (!job.putOk) {
        try {
          const fallbackId = uid("p");
          job.stagingId = fallbackId;
          await putPhoto(fallbackId, file);
          job.putOk = true;
          const prevId = blobIdRef.current;
          if (prevId && prevId !== fallbackId) void deletePhoto(prevId);
          setImageBlobId(fallbackId);
          if (!job.floorUrl) {
            job.floorUrl = originalUrl;
            setPreview(originalUrl);
          }
        } catch {
          /* photo store unavailable — status still explains it */
        }
      }
      setCutStatus(cutFailCopy(kind));
      toast(cutFailCopy(kind));
    } finally {
      if (cutJob.current === job) {
        cutJob.current = null;
        setCutting(false);
      }
    }
  }

  return { imageBlobId, photo, cutting, cutStatus, pickPhoto, abortCut };
}

function PhotoField({
  photo,
  cutting,
  cutStatus,
  onPick,
  frame = "garment",
}: {
  photo?: string;
  cutting: boolean;
  cutStatus: string;
  onPick: (file: File) => void;
  frame?: "garment" | "product";
}) {
  return (
    <Field label="Photo">
      <div className="flex items-center gap-3">
        <div
          className={
            frame === "product"
              ? "outfit-studio size-20 overflow-hidden rounded-lg"
              : "outfit-studio h-28 w-[5.25rem] overflow-hidden rounded-lg"
          }
        >
          {photo ? (
            <img
              src={photo}
              alt=""
              className="size-full object-contain object-center"
            />
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <label
            className={cn(
              "inline-flex h-11 cursor-pointer items-center rounded-md bg-raised px-3 text-sm text-fg shadow-[var(--shadow-border)]",
              cutting && "pointer-events-none opacity-50",
            )}
          >
            Take photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onPick(file);
                e.target.value = "";
              }}
            />
          </label>
          <label
            className={cn(
              "inline-flex h-11 cursor-pointer items-center rounded-md bg-raised px-3 text-sm text-fg shadow-[var(--shadow-border)]",
              cutting && "pointer-events-none opacity-50",
            )}
          >
            Photo library
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onPick(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>
      {cutting || cutStatus ? (
        <p className="mt-2 text-xs text-muted">
          {cutStatus || "Isolating from the floor…"}
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted">
          Lay it flat. If isolation fails, your original photo still becomes
          the tile.
        </p>
      )}
    </Field>
  );
}

export function GarmentFormDialog({
  open,
  onOpenChange,
  initial,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Garment | null;
  onSave: (g: Omit<Garment, "id" | "createdAt">) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [category, setCategory] = useState<GarmentCategory>(
    initial?.category ?? "tops",
  );
  const [colorName, setColorName] = useState(
    initial?.colorFamily || initial?.colorName || "",
  );
  const [hex, setHex] = useState(initial?.hex ?? "#d8d6cf");
  const [material, setMaterial] = useState(initial?.material ?? "");
  const [formality, setFormality] = useState<Formality | "">(
    initial?.formality ?? "",
  );
  const [seasons, setSeasons] = useState<Season[]>(
    initial?.seasons ?? ["all"],
  );
  const [climate, setClimate] = useState<Climate[]>(
    initial?.climate ?? [],
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [details, setDetails] = useState(Boolean(initial));
  const photoCut = useCuttablePhoto(
    initial?.imageBlobId,
    initial?.imageSrc,
  );
  const { imageBlobId, photo, cutting, cutStatus, pickPhoto, abortCut } =
    photoCut;

  const fourReady = Boolean(
    name.trim() && category && formality && climate.length && colorName,
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) abortCut();
        onOpenChange(v);
      }}
    >
      <DialogContent
        title={initial ? "Edit piece" : "Add a piece"}
        description="Photo on the floor. Isolation knocks the background off. If that fails, the original photo still becomes the tile."
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim() || !category) return;
            if (!fourReady) {
              toast.error(
                "Looks need category, formality, climate, and color family.",
              );
              return;
            }
            onSave({
              name: name.trim(),
              brand: brand.trim(),
              category,
              colorName,
              colorFamily: colorName,
              hex,
              material: material.trim(),
              formality: formality as Formality,
              seasons: seasons.length ? seasons : ["all"],
              climate,
              notes: notes.trim(),
              tags,
              imageSrc: imageBlobId ? undefined : initial?.imageSrc,
              imageBlobId,
              photoBlobId: imageBlobId,
            });
            onOpenChange(false);
          }}
        >
          <PhotoField
            photo={photo}
            cutting={cutting}
            cutStatus={cutStatus}
            onPick={(file) => void pickPhoto(file, "garment")}
          />
          <Field label="Name">
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Navy wool overcoat"
            />
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium tracking-wide text-muted">
              Category
            </span>
            <ChipGroup
              options={GARMENT_CATEGORIES}
              labels={CATEGORY_LABELS}
              value={category}
              onChange={(v) => setCategory(v as GarmentCategory)}
            />
          </div>
          <Field label="Color family">
            <div className="flex flex-wrap gap-1.5">
              {FASHION_PALETTE.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  aria-label={c.name}
                  onClick={() => {
                    setHex(c.hex);
                    setColorName(c.name);
                  }}
                  className={cn(
                    "size-8 rounded-full",
                    colorName === c.name
                      ? "ring-2 ring-accent ring-offset-2 ring-offset-surface"
                      : "shadow-[var(--shadow-border)]",
                  )}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium tracking-wide text-muted">
              Formality
            </span>
            <ChipGroup
              options={FORMALITIES}
              labels={FORMALITY_LABELS}
              value={formality}
              onChange={(v) => setFormality(v as Formality)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium tracking-wide text-muted">
              Climate
            </span>
            <ChipGroup
              options={CLIMATES}
              labels={CLIMATE_LABELS}
              value={climate}
              multiple
              onChange={(v) => setClimate(v as Climate[])}
            />
          </div>
          <p className="text-xs text-muted">
            Looks need category, formality, climate, and color family. Missing
            any of those keeps this in Closet only.
          </p>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium tracking-wide text-muted">
              Collections
            </span>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_TAGS.map((tag) => {
                const on = tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() =>
                      setTags((prev) =>
                        on ? prev.filter((t) => t !== tag) : [...prev, tag],
                      )
                    }
                    className={cn(
                      "h-9 rounded-full px-3 text-xs tracking-wide",
                      on
                        ? "bg-accent text-accent-fg"
                        : "bg-raised text-muted shadow-[var(--shadow-border)]",
                    )}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDetails((v) => !v)}
            className="h-11 text-left text-sm text-muted"
          >
            {details ? "Hide details" : "More details"}
          </button>
          {details ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Brand">
                  <Input
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Optional"
                  />
                </Field>
                <Field label="Material">
                  <Input
                    value={material}
                    onChange={(e) => setMaterial(e.target.value)}
                    placeholder="Wool, linen, leather"
                  />
                </Field>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium tracking-wide text-muted">
                  Seasons
                </span>
                <ChipGroup
                  options={SEASONS}
                  labels={SEASON_LABELS}
                  value={seasons}
                  multiple
                  onChange={(v) => setSeasons(v as Season[])}
                />
              </div>
              <Field label="Notes">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Fit, pairing, care"
                />
              </Field>
            </>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="submit" disabled={!fourReady}>
              {initial ? "Save changes" : "Add piece"}
            </Button>
            {onDelete ? (
              <Button type="button" variant="danger" onClick={onDelete}>
                Remove
              </Button>
            ) : null}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ExtraFormDialog({
  open,
  onOpenChange,
  initial,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Extra | null;
  onSave: (e: Omit<Extra, "id" | "createdAt">) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [kind, setKind] = useState<ExtraKind>(initial?.kind ?? "skincare");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [tags] = useState<string[]>(initial?.tags ?? []);
  const [climate, setClimate] = useState<Climate[]>(
    initial?.climate ?? ["mild"],
  );
  const [formality, setFormality] = useState<Formality[]>(
    initial?.formality ?? ["casual", "smart-casual"],
  );
  const [family, setFamily] = useState<FragranceFamily>(
    initial?.family ?? "woody",
  );
  const [slot, setSlot] = useState<SkincareSlot>(initial?.slot ?? "both");
  const [step, setStep] = useState(initial?.step ?? 1);
  const { imageBlobId, photo, cutting, cutStatus, pickPhoto, abortCut } =
    useCuttablePhoto(
      initial?.imageBlobId || initial?.photoBlobId,
      initial?.imageSrc,
    );

  const ready = Boolean(name.trim() && kind);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) abortCut();
        onOpenChange(v);
      }}
    >
      <DialogContent
        title={initial ? "Edit piece" : "Add a piece"}
        description="Photo on the floor. Isolation knocks the background off. If that fails, the original photo still becomes the tile."
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!ready) return;
            onSave({
              name: name.trim(),
              brand: brand.trim(),
              kind,
              notes: notes.trim(),
              tags,
              family: kind === "fragrance" ? family : undefined,
              slot: kind === "skincare" ? slot : undefined,
              step: kind === "skincare" ? step : undefined,
              climate:
                kind === "fragrance"
                  ? climate.length
                    ? climate
                    : ["mild"]
                  : [...CLIMATES],
              formality:
                kind === "fragrance"
                  ? formality.length
                    ? formality
                    : ["casual"]
                  : [...FORMALITIES],
              imageSrc: imageBlobId ? undefined : initial?.imageSrc,
              imageDataUrl: undefined,
              imageBlobId,
              photoBlobId: imageBlobId,
            });
            onOpenChange(false);
          }}
        >
          <PhotoField
            photo={photo}
            cutting={cutting}
            cutStatus={cutStatus}
            frame="product"
            onPick={(file) => void pickPhoto(file, "product")}
          />
          <Field label="Name">
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Vitamin C serum"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Brand">
              <Input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
              />
            </Field>
            <Field label="Kind">
              <NativeSelect
                value={kind}
                onChange={(e) => setKind(e.target.value as ExtraKind)}
              >
                {EXTRA_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {EXTRA_LABELS[k]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          {kind === "fragrance" ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium tracking-wide text-muted">
                Family
              </span>
              <ChipGroup
                options={FRAGRANCE_FAMILIES}
                labels={FAMILY_LABELS}
                value={family}
                onChange={(v) => setFamily(v as FragranceFamily)}
              />
            </div>
          ) : null}
          {kind === "skincare" ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium tracking-wide text-muted">
                  Slot
                </span>
                <ChipGroup
                  options={SKINCARE_SLOTS}
                  labels={SLOT_LABELS}
                  value={slot}
                  onChange={(v) => setSlot(v as SkincareSlot)}
                />
              </div>
              <Field label="Step">
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={step}
                  onChange={(e) => setStep(Number(e.target.value) || 1)}
                />
              </Field>
            </div>
          ) : null}
          {kind === "fragrance" ? (
            <>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium tracking-wide text-muted">
                  Formality
                </span>
                <ChipGroup
                  options={FORMALITIES}
                  labels={FORMALITY_LABELS}
                  value={formality}
                  multiple
                  onChange={(v) => setFormality(v as Formality[])}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium tracking-wide text-muted">
                  Climate
                </span>
                <ChipGroup
                  options={CLIMATES}
                  labels={CLIMATE_LABELS}
                  value={climate}
                  multiple
                  onChange={(v) => setClimate(v as Climate[])}
                />
              </div>
            </>
          ) : null}
          <Field label="Notes">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="submit" disabled={!ready}>
              {initial ? "Save changes" : "Add piece"}
            </Button>
            {onDelete ? (
              <Button type="button" variant="danger" onClick={onDelete}>
                Remove
              </Button>
            ) : null}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
