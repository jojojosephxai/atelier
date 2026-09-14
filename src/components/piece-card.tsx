import { FittedPiece } from "@/components/fitted-piece";
import { usePieceSrc } from "@/lib/media";
import type { Extra, Garment } from "@/lib/types";

export function GarmentCard({
  garment,
  onClick,
  eager,
}: {
  garment: Garment;
  onClick?: () => void;
  eager?: boolean;
}) {
  const src = usePieceSrc(garment);
  return (
    <button
      type="button"
      onClick={onClick}
      className="group closet-tile flex h-full w-full min-w-0 flex-col overflow-hidden rounded-xl bg-surface text-left shadow-[var(--shadow-border)] transition-[box-shadow,transform] duration-150 hover:shadow-[var(--shadow-border-hover)] active:scale-[0.99]"
    >
      <div className="outfit-studio relative aspect-[3/4] w-full overflow-hidden">
        {src ? (
          <FittedPiece src={src} eager={eager} className="absolute inset-0" />
        ) : null}
      </div>
      <div className="caption-band min-h-[3.25rem] min-w-0 px-2.5 py-2">
        <p className="truncate text-sm font-medium">{garment.name}</p>
        <p className="caption-sub truncate text-xs">
          {garment.brand || garment.colorName}
        </p>
      </div>
    </button>
  );
}

export function ExtraCard({
  extra,
  eager,
  onClick,
  tone,
}: {
  extra: Extra;
  eager?: boolean;
  onClick?: () => void;
  tone?: "day" | "night" | "core";
}) {
  const src = usePieceSrc(extra);
  const chapter =
    tone ??
    (extra.kind === "skincare"
      ? extra.slot === "pm"
        ? "night"
        : "day"
      : "core");
  const body = (
    <>
      <div className="outfit-studio relative aspect-square w-full shrink-0 overflow-hidden">
        {src ? (
          <FittedPiece
            src={src}
            eager={eager}
            className="groom-shot absolute inset-0"
          />
        ) : null}
      </div>
      <div className="caption-band flex min-h-14 min-w-0 shrink-0 flex-col justify-center px-2.5 py-2">
        <p className="truncate text-sm leading-snug font-medium">{extra.name}</p>
        <p className="caption-sub mt-0.5 truncate text-xs leading-snug">
          {extra.brand}
        </p>
      </div>
    </>
  );
  const cls =
    "groom-tile closet-tile flex h-full w-full min-w-0 flex-col overflow-hidden rounded-xl shadow-[var(--shadow-border)]";
  if (onClick) {
    return (
      <button
        type="button"
        data-tone={chapter}
        onClick={onClick}
        className={`${cls} text-left transition-[box-shadow,transform] duration-150 hover:shadow-[var(--shadow-border-hover)] active:scale-[0.99]`}
      >
        {body}
      </button>
    );
  }
  return (
    <article data-tone={chapter} className={cls}>
      {body}
    </article>
  );
}
