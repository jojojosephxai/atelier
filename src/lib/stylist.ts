import { createServerFn } from "@tanstack/react-start";
import { clampLookCopy } from "./describe-look";
import type { Brief, Extra, Garment, SuggestedLook } from "./types";

type ItemLite = {
  id: string;
  name: string;
  brand: string;
  category?: string;
  kind?: string;
  colorName?: string;
  material?: string;
  formality: string | string[];
  seasons?: string[];
  climate: string[];
  notes: string;
};

export type StylistInput = {
  brief: Brief;
  styleNotes: string;
  garments: ItemLite[];
  extras: ItemLite[];
};

export type StylistResult =
  | { ok: true; looks: SuggestedLook[] }
  | { ok: false; error: string };

function liteGarment(g: Garment): ItemLite {
  return {
    id: g.id,
    name: g.name,
    brand: g.brand,
    category: g.category,
    colorName: g.colorName,
    material: g.material,
    formality: g.formality,
    seasons: g.seasons,
    climate: g.climate,
    notes: g.notes.slice(0, 140),
  };
}

export function toStylistPayload(
  garments: Garment[],
  _extras: Extra[],
  brief: Brief,
  styleNotes: string,
): StylistInput {
  return {
    brief,
    styleNotes: styleNotes.slice(0, 400),
    garments: garments.slice(0, 80).map(liteGarment),
    extras: [],
  };
}

function parseLooksJson(text: string): Array<Partial<SuggestedLook>> {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return [];
  const parsed = JSON.parse(raw.slice(start, end + 1)) as {
    looks?: Array<Partial<SuggestedLook>>;
  };
  return parsed.looks ?? [];
}

const MODELS = ["grok-4.5", "grok-4", "grok-3"];

export const composeWithGrok = createServerFn({ method: "POST" })
  .validator((input: StylistInput) => input)
  .handler(async ({ data }): Promise<StylistResult> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "Grok is not available in this environment." };
    }

    const system = `You are the in-house stylist for Atelier.
Compose exactly 3 complete, DISTINCT outfits using ONLY the provided garment ids.
Rules:
- Each look needs footwear and either a dress or (top + bottom).
- Add outerwear when climate is cool, cold, rain, or snow.
- Gym looks may only layer a hoodie or quarter-zip over a tee. No harrington, rain shell, denim jacket, or field jacket on gym.
- Clothes only. No fragrance, skincare, grooming, extraIds.
- Do not invent ids.
- Names MUST be the pieces, like "Field jacket + grey tee" or "Quarter-zip over gym tee". Never "Black Black ceremony", never "Hall pass".
- Rationale: 1–2 sentences, 25–40 words (hard cap 45). Sound like a sharp, understated stylist: real colors, 2–3 key pieces, fit only if it appears in name/notes, the brief's occasion, and a subtle impression of the OUTFIT (not the wearer). Vary the three. No headings, bullets, personality claims, or filler (“stylish and versatile”, “perfect for any”, “effortlessly fashionable”). Never invent colors, materials, or fits.
Return JSON only: {"looks":[{"name":"","garmentIds":[],"rationale":"","climateNotes":"","incomplete":[]}]}`;

    const user = JSON.stringify({
      brief: data.brief,
      styleNotes: data.styleNotes,
      wardrobe: data.garments,
    });

    let lastErr = "Stylist request failed.";
    for (const model of MODELS) {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          response_format: { type: "json_object" },
          max_tokens: 1800,
          temperature: 0.7,
        }),
      });
      if (!res.ok) {
        lastErr = `Stylist request failed (${res.status}).`;
        continue;
      }
      const body = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = body.choices?.[0]?.message?.content ?? "";
      let rows: Array<Partial<SuggestedLook>> = [];
      try {
        rows = parseLooksJson(text);
      } catch {
        lastErr = "The stylist returned an unreadable response.";
        continue;
      }
      const allowedG = new Set(data.garments.map((g) => g.id));
      const looks: SuggestedLook[] = rows
        .slice(0, 3)
        .map((look, i) => ({
          name: String(look.name ?? `Look ${i + 1}`).slice(0, 64),
          garmentIds: (look.garmentIds ?? []).filter((id) => allowedG.has(id)),
          extraIds: [],
          score: 80 - i * 4,
          rationale: clampLookCopy(String(look.rationale ?? "")).slice(0, 320),
          climateNotes: String(look.climateNotes ?? "").slice(0, 160),
          incomplete: Array.isArray(look.incomplete)
            ? look.incomplete.map(String).slice(0, 6)
            : [],
          source: "stylist" as const,
        }))
        .filter((l) => l.garmentIds.length > 0);
      if (looks.length) return { ok: true, looks };
      lastErr = "Grok could not compose from this closet.";
    }
    return { ok: false, error: lastErr };
  });

export type CaptionLook = {
  id: string;
  pieces: Array<{
    name: string;
    brand: string;
    category: string;
    material: string;
    colorName: string;
    formality?: string;
    notes?: string;
  }>;
};

export type CaptionInput = {
  routine: string;
  climate: string;
  looks: CaptionLook[];
};

export type CaptionResult =
  | {
      ok: true;
      names: Record<string, string>;
      lines: Record<string, string>;
    }
  | { ok: false; error: string };

export const captionLooks = createServerFn({ method: "POST" })
  .validator((input: CaptionInput) => input)
  .handler(async ({ data }): Promise<CaptionResult> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "Grok is not available in this environment." };
    }

    const system = `You title and caption 3 already-composed outfits. Do not add, drop, or swap pieces.

NAMES: 2–4 words, distinct look-card titles (e.g. "Rain hall kit", "Fleece over mesh"). Never a laundry list of garment names. Never "Look 1", "Hall pass", "Black Black ceremony". Grounded in THIS kit.

WHY — the only caption the user sees. Hard UI space:
- 1–2 sentences. Prefer the short end.
- 25–40 words. Never over 45. Never a paragraph.
- No headings, bullets, or line breaks.
- Do not repeat the title or list every item.

Internally identify, then write from those facts (do not output the facts):
- dominant_color + secondary_colors — only colors present in the piece data
- key_pieces — 2–3 actual garments
- silhouette — ONLY if a fit word appears in name or notes (relaxed, oversized, fitted, straight, slim, cropped, tailored, loose, boxy). Otherwise omit.
- occasion — must match the given routine (school / weekend / gym / going out)
- visual_impression — a brief read of the outfit, not the person

If you must cut, keep in this order: colors, key pieces, fit, occasion, impression.

Impression: "navy tones give a calm, composed feel" — never "blue means you are trustworthy." Never personality claims about the wearer.

Do not invent colors, materials, patterns, brands, garment types, fits, or occasions. Missing fact → skip it.

Vary openings across the three looks (which item leads, where the impression sits). Gym: never describe a harrington, rain shell, denim, or field jacket.

Return JSON only: {"looks":[{"id":"","name":"","why":""}]}`;

    const user = JSON.stringify({
      routine: data.routine,
      climate: data.climate,
      looks: data.looks,
    });

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        max_tokens: 900,
        temperature: 0.55,
      }),
    });
    if (!res.ok) {
      return { ok: false, error: `xAI API error ${res.status}` };
    }
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = body.choices?.[0]?.message?.content ?? "";
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) {
      return { ok: false, error: "Unreadable stylist response." };
    }
    try {
      const parsed = JSON.parse(text.slice(start, end + 1)) as {
        looks?: Array<{ id?: string; name?: string; why?: string }>;
      };
      const names: Record<string, string> = {};
      const lines: Record<string, string> = {};
      for (const row of parsed.looks ?? []) {
        const id = String(row.id ?? "");
        if (!id) continue;
        if (row.name) names[id] = String(row.name).slice(0, 42);
        if (row.why) lines[id] = clampLookCopy(String(row.why));
      }
      if (!Object.keys(names).length && !Object.keys(lines).length) {
        return { ok: false, error: "Empty stylist response." };
      }
      return { ok: true, names, lines };
    } catch {
      return { ok: false, error: "Unreadable stylist response." };
    }
  });
