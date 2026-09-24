# First build step — install OpenDex (Jarvis HUD)

This is the **movie face**. Do this on your computer (Mac / Windows / Linux). Phone comes from Cursor later — OpenDex is desktop-only.

## 1. Download

Open the latest release:

**https://github.com/wassgha/opendex/releases/latest**

Pick your file:

| Your computer | Download |
| --- | --- |
| Mac (Apple Silicon M1/M2/M3/M4) | `OpenDex-mac-arm64.dmg` |
| Mac (Intel) | `OpenDex-mac-x64.dmg` |
| Windows | `OpenDex-Setup.exe` |
| Linux | `OpenDex-linux.AppImage` (or `.deb`) |

Current known latest at time of writing: **v1.1.14**.

## 2. Install & open

- **Mac:** open the `.dmg`, drag OpenDex to Applications, launch it.  
- **Windows:** run `OpenDex-Setup.exe`, finish the wizard, launch OpenDex.  
- **Linux AppImage:** `chmod +x OpenDex-linux.AppImage && ./OpenDex-linux.AppImage`

## 3. Onboarding (match the aesthetic)

When the wizard appears:

1. **Theme:** choose **Jarvis HUD** (not Talking Dot / Typing Cursor).  
2. **Wake:** push-to-talk is safest first; add Vosk wake word after it works.  
3. **Voice in:** local Whisper or Vosk (free) if offered.  
4. **Voice out:** **System voice** (free) — skip ElevenLabs for now (extra key/cost).  
5. **Model / brain (day one, no new sub):**  
   - **Mac with Apple Intelligence:** pick that (no API key).  
   - Otherwise: you need *one* of OpenAI / Anthropic / xAI **API** key or AI Gateway.  
   - **Important:** SuperGrok **chat** subscription is **not** an xAI API key. Don’t expect SuperGrok alone to fill OpenDex’s `XAI_API_KEY` field.  
6. **Greeting:** set something like:  
   `Good evening, Joseph. All systems online. How can I help?`

## 4. Smoke test (pass/fail)

Say or type:

> Introduce yourself as Jarvis. Confirm you know my name is Joseph. Give a three-line morning briefing style status.

**Pass if:** HUD reacts, voice or text replies, feels like a bootstrapped assistant — not a blank browser chat.

## 5. Morning-briefing vibe (reel DdRp2rqpwHI)

In settings / personality, add:

> On wake or when I say “brief me,” give a short Iron Man–style status: greeting, 3 bullets of what matters today (school, tasks, research), then ask what to tackle first. Keep it under 30 seconds spoken.

## 6. After OpenDex works

1. Paste your merged About Joseph into `jarvis/JOSEPH.profile.md` in this repo.  
2. Follow [CURSOR-WIRING.md](./CURSOR-WIRING.md) so **Cursor** handles coding / heavy research / away jobs.  
3. On phone: use Cursor Agents with the same User Rules — same memory, different face.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| App won’t open on Mac | System Settings → Privacy & Security → allow OpenDex |
| No voice | Check mic permission; fall back to push-to-talk |
| Wants an API key and you’re stuck | Use Apple Intelligence on Mac, or use OpenDex as **UI practice** while Cursor Agent is the real brain until we wire Cursor SDK |
| Computer-use / clicking desktop | Leave **off** until you trust it; enable later under Skills with Ask permission |
