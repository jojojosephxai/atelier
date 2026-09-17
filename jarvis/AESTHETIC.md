# Aesthetic requirements (from the 4 reels + Iron Man vibe)

These are the **must-feel** requirements. Captions from Instagram do not include frame-by-frame video; requirements below combine each reel’s stated demo with the standard “movie Jarvis” visual language those creators sell.

## Reel → requirement

| Reel | Stated demo | Aesthetic / UX requirement |
| --- | --- | --- |
| `DdRp2rqpwHI` (lukebuildsai) | Wake up; email/replies/support already done; Jarvis “calls” you | **Boot → briefing.** On wake, speak a short status (“systems online… overnight: …”). Dark HUD, calm British-ish or clear assistant voice. |
| `Dc8RPP8zcAV` (dhaibuilds) | Build-your-own Jarvis inside a chat product | **Polished conversation surface** — not a raw terminal. Mic-reactive UI, clear listening / thinking / speaking states. |
| `DboqOSvEj_b` (zubair) | Free Jarvis build with a coding agent behind it | **Face ≠ brain.** Cinematic shell in front; real agent (Cursor) does research/build work behind. |
| `Db6KlOhJYLk` (lukebuildsai) | Jarvis audits other agents, flags conflicts | **Phase 2 only.** Multi-agent oversight after single-assistant HUD works. |

## Movie checklist (day one must pass)

- [x] **Startup / boot sequence** — `jarvis/hud` reactor + system log (`npm run jarvis`)
- [x] **HUD chrome** — dark + cyan glow, clipped panels, orb rings
- [x] **Wake** — mic button + Space hotkey (wake-word phrase handled in typed/spoken commands)
- [x] **Voice in + voice out** — Web Speech STT + TTS
- [x] **State colors** — idle / listening / thinking / speaking
- [x] **Personalized greeting** — Joseph + Conestoga / UMLY briefing
- [x] **Morning briefing script** — Brief me + day-aware swim/school tips
- [x] **No Grok Bot** in the critical path
- [ ] **Cursor live brain** — bridge stub in `jarvis/bridge/` (phase 2)
- [ ] **OpenDex desktop package** — optional alternate face (see INSTALL-OPENDEX.md)

## Explicit non-goals (day one)

- Buying the Instagram CTA “comment Jarvis” SaaS platforms
- Perfect Iron Man holograms / AR glasses
- Multi-agent auditor mesh (reel 4) before the HUD works
- Burning Grok Bot weekly usage for chat

## Reference open-source faces

| Project | Startup strength | HUD strength | Install ease | Cursor brain built-in? |
| --- | --- | --- | --- | --- |
| **OpenDex** | Onboarding + themes | **Jarvis HUD theme** | **Signed releases** | No — pluggable models |
| **jarvis-home** | **Clap → Earth zoom → briefing** | Strong cinematic | Clone + npm | No — BrainAdapter |
| Anandb71/J.A.R.V.I.S | Cinematic phases | Transparent HUD | Build from source | No |

**Day-one pick:** OpenDex (fastest path to “looks like the reels”).  
**Upgrade path for boot porn:** jarvis-home Earth’s sequence, or fork OpenDex theme later.
