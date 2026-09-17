import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import {
  BOARD_SAMPLES,
  DEFAULT_BOARD,
  mergeBoard,
  type BoardSlot,
  type BoardSlotId,
} from "@/lib/board";
import { cn } from "@/lib/utils";

const SAMPLE_DEFAULT: Record<BoardSlotId, boolean> = {
  hat: true,
  tops: true,
  outerwear: true,
  dresses: false,
  bottoms: true,
  footwear: true,
  accessory: true,
  bag: true,
};

export function BoardEditor({
  slots,
  onChange,
}: {
  slots: BoardSlot[];
  onChange: (next: BoardSlot[]) => void;
}) {
  const board = mergeBoard(slots);
  const [sampleOn, setSampleOn] = useState<Record<BoardSlotId, boolean>>(
    SAMPLE_DEFAULT,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            setSampleOn((cur) => {
              const any = Object.values(cur).some(Boolean);
              const next = { ...cur };
              for (const id of Object.keys(next) as BoardSlotId[]) {
                next[id] = !any;
              }
              return next;
            })
          }
          className="h-11 rounded-full bg-raised px-4 text-sm text-muted"
        >
          {Object.values(sampleOn).some(Boolean)
            ? "Hide samples"
            : "Show samples"}
        </button>
        <button
          type="button"
          onClick={() => onChange(DEFAULT_BOARD.map((s) => ({ ...s })))}
          className="h-11 rounded-full bg-raised px-4 text-sm text-muted"
        >
          Reset labels
        </button>
      </div>

      <div className="board-tiles">
        {board.map((slot) => {
          const src = sampleOn[slot.id] ? BOARD_SAMPLES[slot.id] : undefined;
          return (
            <article
              key={slot.id}
              className={cn(
                "kit-tile min-w-0",
                slot.visible ? "" : "opacity-45",
              )}
            >
              <div className="outfit-studio relative w-full overflow-hidden">
                {src ? (
                  <img
                    src={src}
                    alt=""
                    draggable={false}
                    className="absolute inset-0 size-full object-contain p-[8%]"
                  />
                ) : null}
              </div>
              <div className="flex items-center gap-1 bg-[var(--atelier-caption)] px-1.5 py-1.5">
                <button
                  type="button"
                  aria-label={slot.visible ? "Hide box" : "Show box"}
                  onClick={() =>
                    onChange(
                      board.map((s) =>
                        s.id === slot.id ? { ...s, visible: !s.visible } : s,
                      ),
                    )
                  }
                  className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:text-fg"
                >
                  {slot.visible ? (
                    <Eye className="size-3.5" />
                  ) : (
                    <EyeOff className="size-3.5" />
                  )}
                </button>
                <input
                  value={slot.label}
                  aria-label={`${slot.id} label`}
                  onChange={(e) =>
                    onChange(
                      board.map((s) =>
                        s.id === slot.id
                          ? { ...s, label: e.target.value }
                          : s,
                      ),
                    )
                  }
                  className="kit-label h-11 min-w-0 flex-1 rounded-md bg-transparent px-1 text-left uppercase outline-none"
                />
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
