#!/usr/bin/env node
/**
 * Placeholder HTTP bridge. Returns a clear "not wired" payload until
 * @cursor/sdk is connected in a follow-up session.
 */
import http from "node:http";

const PORT = Number(process.env.JARVIS_BRIDGE_PORT || 8790);

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
    res.end(JSON.stringify({ ok: true, brain: "stub", cursor: false }));
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
  console.log(`Jarvis bridge stub on http://127.0.0.1:${PORT}`);
});
