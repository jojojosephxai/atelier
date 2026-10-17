import test from "node:test";
import assert from "node:assert/strict";
import { buildBriefing, greetingLine, PROFILE } from "./profile-data.js";

test("profile has Joseph identity", () => {
  assert.equal(PROFILE.name, "Joseph");
  assert.match(PROFILE.school, /Conestoga/);
  assert.ok(PROFILE.swim.events.includes("100 breast"));
});

test("briefing is day-aware", () => {
  const thu = new Date("2026-09-17T15:00:00");
  const b = buildBriefing(thu);
  assert.match(b.title, /Joseph/);
  assert.ok(b.lines.some((l) => /Sprint|protect/i.test(l)));
  assert.equal(b.tonight.length, 4);
});

test("greeting changes by hour", () => {
  assert.equal(greetingLine(new Date("2026-09-17T09:00:00")), "Good morning");
  assert.equal(greetingLine(new Date("2026-09-17T15:00:00")), "Good afternoon");
  assert.equal(greetingLine(new Date("2026-09-17T20:00:00")), "Good evening");
});
