import { memo } from "react";
import { FittedPiece } from "@/components/fitted-piece";
import { isGymLayer } from "@/lib/board-set";
import { usePieceSrc } from "@/lib/media";
import type { Extra, Garment, GarmentCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

const ORDER: GarmentCategory[] = [
  "outerwear",
  "tops",
  "dresses",
  "bottoms",
  "footwear",
  "accessories",
  "bags",
];

const TILE_LABEL: Record<GarmentCategory, string> = {
  outerwear: "Outer",
  tops: "Top",
  bottoms: "Bottom",
  dresses: "Dress",
  footwear: "Shoes",
  accessories: "Extra",
  bags: "Bag",
};

const PieceTile = memo(function PieceTile({
  garment,
  eager,
}: {
  garment: Garment;
  eager?: boolean;
}) {
  const src = usePieceSrc(garment);
  const label =
    isGymLayer(garment) && garment.category === "tops"
      ? "Layer"
      : TILE_LABEL[garment.category];
  return (
    <article className="kit-tile min-w-0">
      <div className="outfit-studio relative w-full overflow-hidden">
        {src ? (
          <FittedPiece src={src} alt="" eager={eager} className="absolute inset-0" />
        ) : null}
      </div>
      <p className="kit-label">{label}</p>
    </article>
  );
});

export const LookGrid = memo(function LookGrid({
  garments,
  className,
  eager,
}: {
  garments: Garment[];
  extras?: Extra[];
  className?: string;
  compact?: boolean;
  eager?: boolean;
  layoutKey?: string;
}) {
  const tiles = [...garments].sort(
    (a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category),
  );
  const count = tiles.length;
  return (
    <div
      className={cn("piece-grid", className)}
      data-count={count > 6 ? 6 : count}
    >
      {tiles.map((g, i) => (
        <PieceTile key={g.id} garment={g} eager={eager || i < 6} />
      ))}
    </div>
  );
});
