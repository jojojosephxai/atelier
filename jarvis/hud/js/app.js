import { PROFILE, buildBriefing, greetingLine } from "./profile-data.js";
import { startStarfield } from "./stars.js";
import { playBootChirp, playAckBlip } from "./sfx.js";
import { askBridge, bridgeHealth } from "./bridge-client.js";

const BOOT_LINES = [
  "Initializing personal instance…",
  "Loading Joseph profile kernel…",
  "Calibrating Conestoga + UMLY schedules…",
  "Voice stack: Web Speech API",
  "Policy: no Grok Bot · no new subscriptions",
  "Arc reactor simulation online",
  "Handshake complete. Welcome back.",
];

const state = {
  voiceOn: true,
  listening: false,
  recognition: null,
  bootDone: false,
};

const el = {
  boot: document.getElementById("boot"),
  bootLog: document.getElementById("boot-log"),
  bootBar: document.getElementById("boot-bar"),
  bootPct: document.getElementById("boot-pct"),
  skip: document.getElementById("skip-boot"),
  hud: document.getElementById("hud"),
  clock: document.getElementById("clock"),
  statePill: document.getElementById("state-pill"),
  orb: document.getElementById("orb"),
  briefing: document.getElementById("briefing"),
  tonight: document.getElementById("tonight-list"),
  feed: document.getElementById("feed"),
  transcript: document.getElementById("transcript"),
  mic: document.getElementById("mic-btn"),
  form: document.getElementById("chat-form"),
  input: document.getElementById("chat-input"),
  briefBtn: document.getElementById("brief-btn"),
  speakToggle: document.getElementById("speak-toggle"),
  sysVoice: document.getElementById("sys-voice"),
  stars: document.getElementById("starfield"),
  sysCursor: document.getElementById("sys-cursor"),
};

function setState(mode) {
  const map = {
    idle: ["STANDBY", "pill--idle"],
    listen: ["LISTENING", "pill--listen"],
    think: ["THINKING", "pill--think"],
    speak: ["SPEAKING", "pill--speak"],
  };
  const [label, cls] = map[mode] || map.idle;
  el.statePill.className = `pill ${cls}`;
  el.statePill.textContent = label;
  el.orb.classList.toggle("is-listen", mode === "listen");
  el.orb.classList.toggle("is-speak", mode === "speak");
}

function tickClock() {
  const now = new Date();
  el.clock.textContent = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function speak(text) {
  if (!state.voiceOn || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.02;
  u.pitch = 0.92;
  const voices = window.speechSynthesis.getVoices();
  const preferred =
    voices.find((v) => /en(-|_)GB/i.test(v.lang) && /male|daniel|george|ryan/i.test(v.name)) ||
    voices.find((v) => /en(-|_)GB/i.test(v.lang)) ||
    voices.find((v) => /en(-|_)US/i.test(v.lang));
  if (preferred) u.voice = preferred;
  setState("speak");
  u.onend = () => setState("idle");
  window.speechSynthesis.speak(u);
}

function addFeed(role, text) {
  const node = document.createElement("div");
  node.className = `msg${role === "You" ? " msg--user" : ""}`;
  node.innerHTML = `<strong>${role}</strong><div></div>`;
  node.querySelector("div").textContent = text;
  el.feed.prepend(node);
}

function renderBriefing() {
  const b = buildBriefing();
  el.briefing.innerHTML = `
    <p><strong>${b.title}</strong></p>
    <ul>${b.lines.map((l) => `<li>${l}</li>`).join("")}</ul>
  `;
  el.tonight.innerHTML = b.tonight.map((t) => `<li>${t}</li>`).join("");
}

function jarvisReply(raw) {
  const q = raw.trim().toLowerCase();
  if (!q) return "Standing by.";

  if (/^(hey )?jarvis\b/.test(q) && q.replace(/^(hey )?jarvis[,!.\s]*/i, "").length < 2) {
    return `${greetingLine()}, ${PROFILE.name}. Systems online. What do you need?`;
  }

  if (/brief|status|morning|wake|systems/.test(q)) {
    const b = buildBriefing();
    return `${b.title} ${b.lines.join(" ")}`;
  }

  if (/school|homework|bio|world|tonight|due/.test(q)) {
    return [
      "School first.",
      `Heavy load: ${PROFILE.schoolDay.heavy.join(", ")}.`,
      "Send what's due (class + task). I'll triage must-submit / must-study / can-slide.",
      "One timed AP block, then stop. I won't write the assignment for you — I'll quiz and map it.",
      PROFILE.schoolDay.homeworkCutoff,
    ].join(" ");
  }

  if (/swim|practice|umly|breast|meet|vo2/.test(q)) {
    return [
      `${PROFILE.swim.team}, ${PROFILE.swim.group}. Main events: ${PROFILE.swim.events.join(", ")}.`,
      "Normal week:",
      PROFILE.swim.week.join("; ") + ".",
      `Near meets: ${PROFILE.meetsNear.join("; ")}.`,
      "Confirm whether today is single, double, meet, or off before we add anything.",
      "I won't rewrite coach sets.",
    ].join(" ");
  }

  if (/atelier|code|cursor|app/.test(q)) {
    return [
      "Atelier stays a private wardrobe tool — no social/shop/feed creep.",
      "Ship the smallest finished piece in Cursor. Tell me the file, the bug, and what done means tonight.",
      "Tools you already have: Cursor Pro + SuperGrok. No new subscriptions. Grok Bot stays sparse.",
    ].join(" ");
  }

  if (/who am i|about me|profile|remember/.test(q)) {
    return [
      `${PROFILE.fullName}. ${PROFILE.grade}, ${PROFILE.school}.`,
      `Tone: ${PROFILE.tone}.`,
      `Near goals: ${PROFILE.goalsNear.slice(0, 3).join("; ")}.`,
      "Ask each time: what's due tonight, practice type, energy/sleep.",
    ].join(" ");
  }

  if (/faith|church|bible|scripture/.test(q)) {
    return "Faith matters to you — not flavor text. I can close serious character topics with brief biblical and logical support. I won't preach on every homework question. Church-class/baptism status: ask only if you bring it up.";
  }

  if (/remind|watch|research topic|ping/.test(q)) {
    return "Name the topic and the ping rule (daily short bullets vs only big changes). I only ping on that rule. School block wins if both fight for the same hour.";
  }

  if (/sleep|bed|tired|10:15/.test(q)) {
    return "Sleep is a performance input. Mon/Wed/Thu aim lights-out ~10:15–10:30 after practice nights. After 10:15: homework stops, kitchen closed, phone off the pillow.";
  }

  if (/help|what can you do|commands/.test(q)) {
    return "Try: brief me · school tonight · swim · atelier · who am I · sleep · research watch. Mic or Space to talk.";
  }

  return [
    "Got it.",
    "Default lanes: triage school, explain simply, research brief, coding in Cursor, swim-aware planning.",
    "Say the due list, or ask for a briefing. I won't invent grades, times, or loads you didn't give.",
  ].join(" ");
}

async function handleCommand(text) {
  const cleaned = text.replace(/^(hey )?jarvis[,!.\s]*/i, "").trim() || text;
  addFeed("You", text);
  playAckBlip();
  setState("think");
  await new Promise((r) => setTimeout(r, 280));
  const remote = await askBridge(cleaned);
  const reply = remote || jarvisReply(cleaned);
  addFeed("Jarvis", reply);
  el.transcript.textContent = reply;
  speak(reply);
  if (!state.voiceOn) setState("idle");
}

function enterHud() {
  if (state.bootDone) return;
  state.bootDone = true;
  playBootChirp();
  el.boot.classList.add("is-done");
  setTimeout(async () => {
    el.boot.hidden = true;
    el.boot.classList.add("is-hidden");
    el.hud.hidden = false;
    el.hud.classList.remove("is-hidden");
    renderBriefing();
    if (el.sysCursor) {
      const up = await bridgeHealth();
      if (up) {
        el.sysCursor.textContent = "STUB";
        el.sysCursor.classList.remove("dim");
        el.sysCursor.title = "Bridge online — Cursor SDK not wired yet";
      }
    }
    const open = `${greetingLine()}, ${PROFILE.name}. All systems online. How can I help?`;
    addFeed("Jarvis", open);
    el.transcript.textContent = open;
    speak(open);
  }, 650);
}

function runBoot() {
  let i = 0;
  const step = () => {
    if (state.bootDone) return;
    if (i < BOOT_LINES.length) {
      const li = document.createElement("li");
      li.textContent = BOOT_LINES[i];
      el.bootLog.appendChild(li);
      i += 1;
      const pct = Math.round((i / BOOT_LINES.length) * 100);
      el.bootBar.style.width = `${pct}%`;
      el.bootPct.textContent = `${pct}%`;
      setTimeout(step, 420);
    } else {
      setTimeout(enterHud, 500);
    }
  };
  step();
}

function initVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    el.sysVoice.textContent = "LIMITED";
    el.sysVoice.title = "Speech recognition not in this browser — type instead";
    return;
  }
  const rec = new SR();
  rec.lang = "en-US";
  rec.interimResults = true;
  rec.continuous = false;
  rec.onstart = () => {
    state.listening = true;
    el.mic.classList.add("is-hot");
    setState("listen");
  };
  rec.onend = () => {
    state.listening = false;
    el.mic.classList.remove("is-hot");
    if (el.statePill.textContent === "LISTENING") setState("idle");
  };
  rec.onerror = () => {
    state.listening = false;
    el.mic.classList.remove("is-hot");
    setState("idle");
  };
  rec.onresult = (ev) => {
    let final = "";
    let interim = "";
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const t = ev.results[i][0].transcript;
      if (ev.results[i].isFinal) final += t;
      else interim += t;
    }
    el.transcript.textContent = final || interim;
    if (final) handleCommand(final.trim());
  };
  state.recognition = rec;
}

el.skip.addEventListener("click", enterHud);
el.mic.addEventListener("click", () => {
  if (!state.recognition) {
    el.transcript.textContent = "Voice input isn't available here — type a command.";
    return;
  }
  if (state.listening) {
    state.recognition.stop();
    return;
  }
  try {
    state.recognition.start();
  } catch {
    /* already started */
  }
});
el.form.addEventListener("submit", (e) => {
  e.preventDefault();
  const v = el.input.value.trim();
  if (!v) return;
  el.input.value = "";
  handleCommand(v);
});
el.briefBtn.addEventListener("click", () => handleCommand("brief me"));
el.speakToggle.addEventListener("click", () => {
  state.voiceOn = !state.voiceOn;
  el.speakToggle.dataset.on = state.voiceOn ? "1" : "0";
  el.speakToggle.textContent = state.voiceOn ? "Voice on" : "Voice off";
  if (!state.voiceOn) window.speechSynthesis?.cancel();
});

tickClock();
setInterval(tickClock, 1000);
window.speechSynthesis?.addEventListener?.("voiceschanged", () => {});
initVoice();
if (el.stars) startStarfield(el.stars);

document.addEventListener("keydown", (e) => {
  if (e.target === el.input) return;
  if (e.code === "Space" && !e.repeat && state.bootDone) {
    e.preventDefault();
    el.mic.click();
  }
  if (e.key === "Escape" && !state.bootDone) enterHud();
});

runBoot();
