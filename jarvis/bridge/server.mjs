#!/usr/bin/env node
/**
 * Jarvis HTTP bridge.
 * TTS: free edge-tts (en-GB-RyanNeural). Cursor SDK chat still stubbed.
 */
import http from "node:http";
import { synthesizeMp3, ttsConfig } from "./tts.mjs";

const PORT = Number(process.env.JARVIS_BRIDGE_PORT || 8790);

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8") || "{}";
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        brain: "stub",
        cursor: false,
        tts: ttsConfig(),
      }),
    );
    return;
  }

  if (req.url === "/api/tts" && req.method === "POST") {
    try {
      const body = await readJson(req);
      const text = typeof body.text === "string" ? body.text : "";
      const mp3 = await synthesizeMp3(text, {
        voice: typeof body.voice === "string" ? body.voice : undefined,
        rate: typeof body.rate === "string" ? body.rate : undefined,
      });
      if (!mp3) {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "edge-tts unavailable",
            hint: "pip3 install edge-tts  (or set EDGE_TTS_BIN)",
          }),
        );
        return;
      }
      res.writeHead(200, {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(mp3.length),
        "Cache-Control": "no-store",
      });
      res.end(mp3);
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "bad request" }));
    }
    return;
  }

  if (req.url === "/api/chat" && req.method === "POST") {
    res.writeHead(501, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "Cursor SDK bridge not wired yet",
        hint: "Use the local HUD brain for now; next session connects @cursor/sdk",
      }),
    );
    return;
  }

  res.writeHead(404);
  res.end("not found");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Jarvis bridge on http://127.0.0.1:${PORT} (tts: edge-tts)`);
});
