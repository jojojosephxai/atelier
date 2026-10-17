# Cursor wiring (brain + memory, no Grok Bot)

OpenDex is the **face**. Cursor Pro is the **hands** for coding, long research, and jobs that keep running while you’re away.

## Why not Grok Bot?

Grok Bot burns weekly usage fast. SuperGrok stays useful for **chat research in the Grok app**; it is **not** required for the HUD path.

## Day-one split (no code required)

| Job | Where |
| --- | --- |
| Wake, HUD, voice, “movie” feel | OpenDex |
| “Know Joseph” forever | Cursor **User Rules** + `JOSEPH.profile.md` |
| Build apps / fix code / school coding help | Cursor Agent (Composer 2.5 daily; stronger models when needed) |
| Run while laptop closed | Cursor **Cloud Agents** + **Automations** (`/automate`) |
| Phone | Cursor iOS or https://cursor.com/agents — same Rules |

## User Rule to paste (Customize → Rules → User Rules)

```text
You are Jarvis for Joseph (9th grade). Explain simply; he is learning and does not know how to code yet.
Always read and respect jarvis/JOSEPH.profile.md when it exists in the workspace.
Never suggest Grok Bot. Prefer Cursor Agent, Cloud Agents, and Automations.
Do not buy or recommend new AI subscriptions. He has Cursor Pro and SuperGrok.
Ask before sending emails, posting publicly, or changing account settings.
For movie-Jarvis tone: calm, precise, briefly witty — never condescending.
```

## Profile file

1. Rename `JOSEPH.profile.template.md` → `JOSEPH.profile.md` after pasting your merged markdown.  
2. Keep `JOSEPH.profile.md` in `jarvis/` so every Agent in this repo can `@` it.  
3. Optional: in chat say `@jarvis/JOSEPH.profile.md` once so it’s in context.

## Phase 2 — true “Cursor behind OpenDex” (build later)

OpenDex talks to models via Vercel AI SDK providers (Apple / OpenAI / Anthropic / xAI / Gateway). It does **not** speak Cursor natively today.

To make Cursor the OpenDex brain:

1. Create a small local bridge with `@cursor/sdk` (TypeScript) that accepts a prompt and streams Agent output.  
2. Expose it as an OpenAI-compatible HTTP endpoint **or** a custom AI SDK provider.  
3. Point OpenDex at that bridge.  
4. Bill stays on Cursor Pro usage (API key from Cursor Dashboard → API Keys).

Until that bridge exists: use OpenDex for aesthetic + light chat, Cursor for real work. Same profile text in both places.

### Sketch (for a future coding session)

```text
OpenDex  --prompt-->  localhost bridge  --@cursor/sdk-->  Cursor Agent (local or cloud)
                <--stream tokens--
```

Cookbook starters: https://github.com/cursor/cookbook (sdk/quickstart)

## Phone + computer

- **Computer:** OpenDex HUD + Cursor desktop Agent.  
- **Phone:** Cursor Agents app / web — kick off Cloud Agents; no OpenDex on phone.  
- Shared memory = the same User Rules + profile markdown, not Grok Bot sync.

## Phase 3 (reel Db6KlOhJYLk)

Only after HUD + Cursor memory work: Automations that review PRs / other agent runs (“audit the other agents”). Not required for the movie startup feel.
