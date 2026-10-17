/**
 * Phase-2 stub: Cursor SDK bridge for the HUD / OpenDex.
 * Not wired yet — documents the target shape Joseph asked for
 * (movie face → Cursor brain, no Grok Bot).
 *
 * Later: npm i @cursor/sdk && set CURSOR_API_KEY, then
 * `node jarvis/bridge/server.mjs` and point the HUD at /api/chat.
 */
export const BRIDGE_PLAN = {
  goal: "OpenDex or jarvis/hud → localhost bridge → @cursor/sdk Agent",
  env: ["CURSOR_API_KEY"],
  endpoints: {
    health: "GET /health",
    chat: "POST /api/chat { message, profilePath?}",
  },
  notes: [
    "Bill usage to Cursor Pro, not Grok Bot",
    "Load jarvis/JOSEPH.profile.md into the first system turn",
    "Prefer Composer 2.5 for cheap daily; Sonnet for hard coding",
  ],
};
