import { isCoat } from "./look";
import { FORMALITY_RANK, type Extra, type Garment } from "./types";
import { hexToHsl, isNeutralHex } from "./utils";

function sceneOf(occasion: string) {
  const o = occasion.toLowerCase();
  if (/\b(school|class|campus|hall)\b/.test(o)) return "school" as const;
  if (/\b(weekend|errand|saturday|sunday)\b/.test(o)) return "weekend" as const;
  if (/\b(gym|pe|athletic|workout|run)\b/.test(o)) return "gym" as const;
  if (/\b(work|office|business)\b/.test(o)) return "work" as const;
  if (/\b(out|dinner|date|evening|night|wedding)\b/.test(o)) return "out" as const;
  return "day" as const;
}

function colorBond(a: Garment, b: Garment): string {
  const na = isNeutralHex(a.hex);
  const nb = isNeutralHex(b.hex);
  if (na && nb) return "both sit in a quiet neutral range, so nothing fights";
  if (na || nb) {
    const color = na ? b.colorName : a.colorName;
    return `${color.toLowerCase()} has a neutral to land on`;
  }
  const ha = hexToHsl(a.hex).h;
  const hb = hexToHsl(b.hex).h;
  const d = Math.abs(ha - hb);
  const span = d > 180 ? 360 - d : d;
  if (span < 35) return "the colors stay in the same family";
  if (span > 100) return `${a.colorName.toLowerCase()} and ${b.colorName.toLowerCase()} contrast on purpose`;
  return `${a.colorName.toLowerCase()} against ${b.colorName.toLowerCase()} is enough color without noise`;
}

function occFit(scene: ReturnType<typeof sceneOf>): string {
  if (scene === "school") return "right for campus — not gym clothes, not a suit";
  if (scene === "weekend") return "easy enough for a weekend without looking unfinished";
  if (scene === "gym") return "built to move";
  if (scene === "work") return "sharp enough for the room";
  if (scene === "out") return "dressed for the evening, not the lecture hall";
  return "holds as one look";
}

export function whyLookWorks(
  pieces: Garment[],
  extras: Extra[] = [],
  occasion = "",
): string {
  if (!pieces.length) return "";
  const top = pieces.find(
    (p) => p.category === "tops" || p.category === "dresses",
  );
  const bottom = pieces.find((p) => p.category === "bottoms");
  const outer = pieces.find((p) => p.category === "outerwear");
  const feet = pieces.find((p) => p.category === "footwear");
  const bag = pieces.find((p) => p.category === "bags");
  const hat = pieces.find((p) =>
    /\b(hat|cap|beanie)\b/i.test(`${p.name} ${p.notes}`),
  );
  const watch = pieces.find((p) => /\bwatch\b/i.test(p.name));
  const scene = sceneOf(occasion);
  const bits: string[] = [];

  if (top && bottom) {
    const gap = Math.abs(
      FORMALITY_RANK[top.formality] - FORMALITY_RANK[bottom.formality],
    );
    const bond = colorBond(top, bottom);
    bits.push(
      `${top.name} with ${bottom.name.toLowerCase()} ${
        gap <= 1 ? "share a register" : "keep a slight tension"
      } and ${bond}, which is ${occFit(scene)}.`,
    );
  } else if (top) {
    bits.push(`${top.name} is the anchor, and it is ${occFit(scene)}.`);
  }

  if (outer && top) {
    bits.push(
      `The ${isCoat(outer) ? "coat" : "jacket"} (${outer.name.toLowerCase()}) layers over the ${top.name.toLowerCase()} — on for the walk, off in a warm room.`,
    );
  } else if (outer) {
    bits.push(`${outer.name} sets the outline and the temperature.`);
  }

  if (feet) {
    const shoe =
      scene === "work" || scene === "out"
        ? "close the line"
        : "stop the look from going too formal";
    bits.push(`${feet.name} ${shoe}.`);
  }

  const extrasBits = [hat?.name, watch?.name, bag?.name].filter(
    (x): x is string => Boolean(x),
  );
  if (extrasBits.length && bits.length < 3) {
    const list =
      extrasBits.length === 1
        ? extrasBits[0].toLowerCase()
        : extrasBits
            .map((n) => n.toLowerCase())
            .join(", ")
            .replace(/, ([^,]*)$/, " and $1");
    bits.push(`${list} finish it without taking over.`);
  }

  const scent = extras.find((e) => e.kind === "fragrance");
  if (scent && bits.length < 3) {
    bits.push(`${scent.brand} ${scent.name.toLowerCase()} is the scent.`);
  }

  return bits.slice(0, 3).join(" ");
}
