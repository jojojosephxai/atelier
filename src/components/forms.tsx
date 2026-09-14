import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/field";
import { FASHION_PALETTE } from "@/lib/colors";
import { cutBudget, cutGarment, cutProduct } from "@/lib/cutout";
import { deletePhoto, putPhoto } from "@/lib/photo-db";
import { uid } from "@/lib/utils";
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
import { cn } from "@/lib/utils";

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
  const [imageBlobId, setImageBlobId] = useState(initial?.imageBlobId);
  const [preview, setPreview] = useState(initial?.imageSrc);
  const [imageSrc] = useState(initial?.imageSrc);
  const [details, setDetails] = useState(Boolean(initial));
  const [cutting, setCutting] = useState(false);
  const [cutStatus, setCutStatus] = useState("");
  const photo = preview || imageSrc;
  const cutJob = useRef<{
    ac: AbortController;
    stagingId?: string;
    putOk: boolean;
    floorUrl?: string;
  } | null>(null);

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

  async function onPickFile(file?: File) {
    if (!file) return;
    abortCut();
    const budget = cutBudget();
    if (!budget.ok) {
      toast.error("Cut limit reached for today");
      setCutStatus("Cut limit reached for today");
      return;
    }
    const ac = new AbortController();
    const job = {
      ac,
      putOk: false as boolean,
      stagingId: undefined as string | undefined,
    };
    cutJob.current = job;
    setCutting(true);
    setCutStatus("Cutting…");
    try {
      const blob = await cutGarment(file, setCutStatus, ac.signal);
      if (ac.signal.aborted || cutJob.current !== job) {
        throw new DOMException("Aborted", "AbortError");
      }
      if (!blob || blob.size < 64) throw new Error("No garment in the cut");
      const id = uid("p");
      job.stagingId = id;
      await putPhoto(id, blob);
      if (ac.signal.aborted || cutJob.current !== job) {
        await deletePhoto(id);
        throw new DOMException("Aborted", "AbortError");
      }
      job.putOk = true;
      if (imageBlobId && imageBlobId !== id) void deletePhoto(imageBlobId);
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
      setImageBlobId(id);
      setPreview(URL.createObjectURL(blob));
      setCutStatus("Isolated cut saved");
    } catch (err) {
      if (job.stagingId && !job.putOk) void deletePhoto(job.stagingId);
      const aborted =
        (err instanceof DOMException && err.name === "AbortError") ||
        (err instanceof Error && /abort|timed out/i.test(err.message));
      const limit = err instanceof Error && /limit/i.test(err.message);
      const msg = limit
        ? "Cut limit reached for today"
        : aborted
          ? "Cut timed out"
          : "Could not cut that photo";
      setCutStatus(msg);
      toast.error(aborted ? "Could not cut that photo" : msg);
    } finally {
      if (cutJob.current === job) cutJob.current = null;
      setCutting(false);
    }
  }

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
        description="Photo on the floor. On-device AI knocks the background and saves an isolated tile."
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim() || !category) return;
            if (cutting) return;
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
              imageSrc: imageBlobId ? undefined : imageSrc,
              imageBlobId,
              photoBlobId: imageBlobId,
            });
            onOpenChange(false);
          }}
        >
          <Field label="Photo">
            <div className="flex items-center gap-3">
              <div className="outfit-studio h-28 w-[5.25rem] overflow-hidden rounded-lg">
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
                      void onPickFile(e.target.files?.[0]);
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
                      void onPickFile(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>
            {cutting || cutStatus ? (
              <p className="mt-2 text-xs text-muted">{cutStatus || "Cutting…"}</p>
            ) : (
              <p className="mt-2 text-xs text-muted">
                Lay it flat. Floor knocks out. Isolated cut, not the floor photo.
              </p>
            )}
          </Field>
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
            <Button type="submit" disabled={cutting || !fourReady}>
              {cutting ? "Cutting…" : initial ? "Save changes" : "Add piece"}
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
  const [imageBlobId, setImageBlobId] = useState(
    initial?.imageBlobId || initial?.photoBlobId,
  );
  const [preview, setPreview] = useState(initial?.imageSrc);
  const [cutting, setCutting] = useState(false);
  const [cutStatus, setCutStatus] = useState("");
  const photo = preview || initial?.imageSrc;
  const cutJob = useRef<{
    ac: AbortController;
    stagingId?: string;
    putOk: boolean;
    floorUrl?: string;
  } | null>(null);

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

  async function onPickFile(file?: File) {
    if (!file) return;
    abortCut();
    const budget = cutBudget();
    if (!budget.ok) {
      toast.error("Cut limit reached for today");
      setCutStatus("Cut limit reached for today");
      return;
    }
    const ac = new AbortController();
    const job = {
      ac,
      putOk: false as boolean,
      stagingId: undefined as string | undefined,
    };
    cutJob.current = job;
    setCutting(true);
    setCutStatus("Cutting…");
    try {
      const blob = await cutProduct(file, setCutStatus, ac.signal);
      if (ac.signal.aborted || cutJob.current !== job) {
        throw new DOMException("Aborted", "AbortError");
      }
      if (!blob || blob.size < 64) throw new Error("No garment in the cut");
      const id = uid("p");
      job.stagingId = id;
      await putPhoto(id, blob);
      if (ac.signal.aborted || cutJob.current !== job) {
        await deletePhoto(id);
        throw new DOMException("Aborted", "AbortError");
      }
      job.putOk = true;
      if (imageBlobId && imageBlobId !== id) void deletePhoto(imageBlobId);
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
      setImageBlobId(id);
      setPreview(URL.createObjectURL(blob));
      setCutStatus("Isolated cut saved");
    } catch (err) {
      if (job.stagingId && !job.putOk) void deletePhoto(job.stagingId);
      const aborted =
        (err instanceof DOMException && err.name === "AbortError") ||
        (err instanceof Error && /abort|timed out/i.test(err.message));
      const limit = err instanceof Error && /limit/i.test(err.message);
      const msg = limit
        ? "Cut limit reached for today"
        : aborted
          ? "Cut timed out"
          : "Could not cut that photo";
      setCutStatus(msg);
      toast.error(aborted ? "Could not cut that photo" : msg);
    } finally {
      if (cutJob.current === job) cutJob.current = null;
      setCutting(false);
    }
  }

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
        description="Photo on the floor. On-device AI knocks the background and saves an isolated tile."
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!ready || cutting) return;
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
          <Field label="Photo">
            <div className="flex items-center gap-3">
              <div className="outfit-studio size-20 overflow-hidden rounded-lg">
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
                      void onPickFile(e.target.files?.[0]);
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
                      void onPickFile(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>
            {cutting || cutStatus ? (
              <p className="mt-2 text-xs text-muted">{cutStatus || "Cutting…"}</p>
            ) : (
              <p className="mt-2 text-xs text-muted">
                Lay it flat. Floor knocks out. Isolated cut, not the floor photo.
              </p>
            )}
          </Field>
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
              <Field label="Order">
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={step}
                  onChange={(e) => setStep(Number(e.target.value) || 1)}
                  aria-label="Application order"
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
            <Button type="submit" disabled={cutting || !ready}>
              {cutting ? "Cutting…" : initial ? "Save changes" : "Add piece"}
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
