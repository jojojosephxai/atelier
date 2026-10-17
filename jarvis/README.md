# Joseph’s Jarvis (movie aesthetic)

Goal: a **movie-style Jarvis** — cinematic startup, HUD, voice — that knows you, helps with school/life/coding, runs on **phone + computer**, without burning **Grok Bot** usage.

**You already have:** Cursor Pro + SuperGrok  
**Do not use:** Grok Bot (too expensive for this)  
**Face (UI):** in-repo cinematic HUD at [`hud/`](./hud/) (plus optional [OpenDex](https://github.com/wassgha/opendex))  
**Coding hands:** Cursor Agent / Cloud Agents  
**Know-me memory:** [`JOSEPH.profile.md`](./JOSEPH.profile.md) + HUD `profile-data.js`

## Docs in this folder

| File | Purpose |
| --- | --- |
| [hud/README.md](./hud/README.md) | **Run the movie HUD now** (`npm run jarvis`) |
| [AESTHETIC.md](./AESTHETIC.md) | What the Instagram reels imply we must look/feel like |
| [INSTALL-OPENDEX.md](./INSTALL-OPENDEX.md) | Optional: install OpenDex desktop release |
| [CURSOR-WIRING.md](./CURSOR-WIRING.md) | How Cursor stays the brain (no Grok Bot) |
| [JOSEPH.profile.md](./JOSEPH.profile.md) | Your merged About Joseph profile |

## Recommended stack (locked)

```text
jarvis/hud (boot + orb + briefing + voice)  ← movie face / startup (in this repo)
        │
Cursor Pro Agent + Cloud Agents             ← coding / heavy research / away jobs
        │
JOSEPH.profile.md + User Rules              ← “knows a lot about me”
        │
Phone: Cursor iOS / cursor.com/agents       ← same memory; HUD is desktop/browser
```

## First thing to run (right now)

```bash
npm install
npm run jarvis
```

Open **http://localhost:8787** — watch the boot sequence, then try **Brief me**, **school tonight**, **swim**, or the mic / Space.

Optional desktop package: [INSTALL-OPENDEX.md](./INSTALL-OPENDEX.md)  
Also add the User Rule from [CURSOR-WIRING.md](./CURSOR-WIRING.md) (or rely on `.cursor/rules/jarvis-joseph.mdc` already in this repo).

## Inspiration reels

- https://www.instagram.com/reel/DdRp2rqpwHI/ — morning “everything already handled” briefing  
- https://www.instagram.com/reel/Dc8RPP8zcAV/ — polished Jarvis chat/voice UI  
- https://www.instagram.com/reel/DboqOSvEj_b/ — coding-agent hands behind the face  
- https://www.instagram.com/reel/Db6KlOhJYLk/ — multi-agent audit (phase 2, not day one)
