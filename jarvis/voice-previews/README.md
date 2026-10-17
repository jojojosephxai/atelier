# Check the Jarvis voice (edge-tts)

No paid voice app. These are free British male voices from Microsoft Edge TTS.

## Easiest — open the preview page

From the Atelier project folder:

```bash
npm run jarvis:voice
```

That opens a page with **Play** buttons for Ryan and Thomas.  
(Or open `jarvis/voice-previews/index.html` in your browser.)

## Or play the MP3 files directly

In Finder / File Explorer, open:

`jarvis/voice-previews/`

Double-click:

| File | What it is |
| --- | --- |
| `ryan-sample.mp3` | Best starting point |
| `ryan-slower.mp3` | Same voice, slower (often more movie-like) |
| `thomas-sample.mp3` | Alternate British male |

## Make your own line (optional)

Needs Python once:

```bash
pip3 install edge-tts
```

Then:

```bash
edge-tts --voice en-GB-RyanNeural --rate="-8%" \
  --text "Good evening, sir. Shall I proceed?" \
  --write-media my-jarvis.mp3
```

Open `my-jarvis.mp3` to hear it.

## What we will use in the HUD

Default: **en-GB-RyanNeural** at a slightly slower rate.  
Not Paul Bettany’s exact voice — closest free option that still feels Jarvis-ish.
