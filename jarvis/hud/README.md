# Jarvis HUD (in-repo movie face)

Cinematic boot + Iron Man–style HUD that already knows Joseph from `../JOSEPH.profile.md` (distilled into `js/profile-data.js`).

## Run

From the Atelier repo root:

```bash
npm run jarvis
```

Open **http://localhost:8787**

## What you get (reel / movie checklist)

- Full-screen **boot sequence** (reactor rings, system log, progress)
- **JARVIS** brand-first HUD (cyan / black — not purple chat UI)
- Arc-reactor **orb** with idle / listen / speak states
- **Briefing** panel from your schedule (school + UMLY)
- Mic via Web Speech + typed commands
- Spoken replies (browser TTS)
- Commands: `brief me`, `school tonight`, `swim`, `atelier`, `who am I`

## Not yet (phase 2)

- Cursor SDK as the live brain (local replies for now)
- OpenDex packaging — this HUD is the in-repo aesthetic while OpenDex remains optional

## Profile updates

Edit `jarvis/hud/js/profile-data.js` after changing `jarvis/JOSEPH.profile.md` (keep body/medical stats out of the HUD per your omit rule).
