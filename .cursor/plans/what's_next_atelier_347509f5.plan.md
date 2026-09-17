---
name: What's next Atelier
overview: Finish the open why-copy fix (already coded, tests passing), then do one glanceable check on Today. After that, pick one polish item from the roadmap — not a redesign.
todos: []
isProject: false
---

# What's next for Atelier

You’re in good shape. Recent why work is on `main`, and Looks 2×2 centering already landed as `56a5264`.

## Still open on your PC (not on GitHub yet)

- [`src/lib/rich-why.ts`](src/lib/rich-why.ts) + [`src/lib/rich-why.test.ts`](src/lib/rich-why.test.ts) — stops calling denim/harrington a “blazer” and crew a “coat” (seed notes were leaking into role words).
- All 14 why tests pass locally.
- `AGENTS.md` is deleted in your working tree — **leave it alone**; do not bundle it into the why commit.

## Session 1 (right now) — close the loop

1. Open Today on localhost and glance at the three School cards: titles and why lines should match the clothes (jacket/crew/shell, not blazer/coat).
2. If it looks right: **commit and push only** the two `rich-why` files (same pattern as the Looks CSS push).
3. Stop. One change, then done.

## Session 2 (next time you sit down) — one polish item

Your wall roadmap says: personal daily use first; one glaring thing per session; no new screens.

Pick **one**:

- **Cutouts / tiles** — if Closet or Grooming photos still look messy (roadmap C). This is usually the biggest “feels cheap” hit after why-copy.
- **Honesty on Stylist** — say data can leave the device, or hide Consult stylist (checklist leftover).
- **One real-life wear** — use Today tomorrow morning with your real closet; note the single wrong thing (wrong piece, wrong why, blank tile). That note becomes the next Cursor ask.

Do **not** start: shop, share, accounts, Vercel/domain, or a whole-page redesign.

## How to ask Cursor next time

Name the screen + the one wrong thing + what not to touch. Example: “Grooming only. Bottle cutouts have rough edges. Do not change Day/Night layout.”
