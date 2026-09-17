import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Mannequin } from "@/components/mannequin";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { lookHasBody } from "@/lib/look";
import { lookName } from "@/lib/board-set";
import { describeLook } from "@/lib/describe-look";
import { pieceSrc } from "@/lib/media";
import { useWardrobe } from "@/lib/store";
import type { Garment, GarmentCategory } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

const BUILD_CATS: GarmentCategory[] = [
  "outerwear",
  "tops",
  "bottoms",
  "footwear",
  "bags",
  "accessories",
];

export function LookBuilderDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { garments, addLook, profile } = useWardrobe();
  const [name, setName] = useState("");
  const [picks, setPicks] = useState<Partial<Record<GarmentCategory, string>>>(
    {},
  );
  const [accessoryIds, setAccessoryIds] = useState<string[]>([]);

  const selected = useMemo(() => {
    const core = BUILD_CATS.filter((c) => c !== "accessories")
      .map((c) => garments.find((g) => g.id === picks[c]))
      .filter((g): g is Garment => Boolean(g));
    const extrasWear = accessoryIds
      .map((id) => garments.find((g) => g.id === id && g.category === "accessories"))
      .filter((g): g is Garment => Boolean(g));
    return [...core, ...extrasWear];
  }, [garments, picks, accessoryIds]);

  function toggle(cat: GarmentCategory, id: string) {
    if (cat === "accessories") {
      setAccessoryIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
      );
      return;
    }
    setPicks((prev) => ({
      ...prev,
      [cat]: prev[cat] === id ? undefined : id,
    }));
  }

  function save() {
    if (!lookHasBody(selected)) {
      toast("Need a top and bottoms — or a dress");
      return;
    }
    const title = name.trim() || lookName(selected, "school");
    addLook({
      name: title,
      garmentIds: selected.map((g) => g.id),
      extraIds: [],
      occasion: "Custom",
      notes: describeLook(selected, {
        routine: "school",
        climate: profile.defaultClimate,
      }),
      source: "manual",
    });
    toast("Look saved");
    setName("");
    setPicks({});
    setAccessoryIds([]);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Build a look"
        description="One piece per clothing slot. Accessories can take more than one."
        className="sm:max-w-2xl"
      >
        <div className="grid gap-5 md:grid-cols-[0.9fr_1.1fr]">
          <div className="overflow-hidden rounded-lg">
            <Mannequin
              garments={selected}
              extras={[]}
              compact
              layoutKey="draft"
            />
          </div>
          <div className="flex flex-col gap-4">
            <Field label="Name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Field jacket + grey tee"
              />
            </Field>
            {BUILD_CATS.map((cat) => {
              const items = garments.filter((g) => g.category === cat);
              if (!items.length) return null;
              return (
                <div key={cat}>
                  <p className="mb-1.5 text-xs font-medium tracking-wide text-muted">
                    {CATEGORY_LABELS[cat]}
                  </p>
                  <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                    {items.map((g) => {
                      const on =
                        cat === "accessories"
                          ? accessoryIds.includes(g.id)
                          : picks[cat] === g.id;
                      const src = pieceSrc(g);
                      return (
                        <button
                          key={g.id}
                          type="button"
                          title={g.name}
                          onClick={() => toggle(cat, g.id)}
                          className={cn(
                            "outfit-studio size-16 shrink-0 overflow-hidden rounded-md",
                            on
                              ? "ring-2 ring-accent ring-offset-2 ring-offset-surface"
                              : "shadow-[var(--shadow-border)]",
                          )}
                        >
                          {src ? (
                            <img
                              src={src}
                              alt={g.name}
                              loading="lazy"
                              decoding="async"
                              className="size-full object-contain p-0.5"
                            />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <Button
              onClick={save}
              disabled={!lookHasBody(selected)}
            >
              Save look
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
