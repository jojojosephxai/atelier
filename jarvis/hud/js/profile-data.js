/** Distilled profile for HUD — omits body/medical stats per Joseph's standing rule. */
export const PROFILE = {
  name: "Joseph",
  fullName: "Joseph Michael Apoian",
  nickname: "Mr. Potato",
  grade: "9th grade",
  schoolYear: "2026–27",
  school: "Conestoga High School",
  district: "Tredyffrin/Easttown School District",
  area: "Wayne / Main Line, Chester County, PA",
  tone: "direct, brief, plain English — lead with the answer; no fluff or cheerleading",
  swim: {
    team: "Upper Main Line YMCA (UMLY)",
    group: "AG1B",
    events: ["100 breast", "200 breast", "200 IM", "400 IM"],
    week: [
      "Mon 6–8pm distance threshold",
      "Tue 4–6pm IM active rest",
      "Wed 6–8pm VO2 (protect)",
      "Thu 6:15–8:15pm sprint threshold (protect)",
      "Fri off / optional lift later",
      "Sat 10am–12pm active rest or IM",
      "Sun off",
    ],
  },
  schoolDay: {
    firstBell: "7:50",
    out: "2:50",
    lunch: "~10:30am",
    cycle: "Garnet / Gray alternating",
    heavy: ["AP Biology", "AP World History", "Algebra 2"],
    also: ["Spanish 3", "Band/Jazz", "Culinary / Personal Finance"],
    homeworkCutoff: "10:15pm — after that, stop; sleep wins",
  },
  tools: ["Cursor Pro", "SuperGrok", "phone + computer", "Atelier app"],
  avoid: ["Grok Bot heavy use", "new subscriptions", "Ollama/hardware shopping"],
  rules: [
    "Explain simply; beginner coder until shown otherwise",
    "Ask before emailing, posting, or changing accounts",
    "Don't write assignments to turn in",
    "School + swim before coding rabbit holes",
    "Truth over comfort; short over padded",
  ],
  projects: {
    atelier: "Private wardrobe organizer — Cursor-first, not social",
  },
  goalsNear: [
    "Stay current in AP Bio + AP World",
    "Protect Wed VO2 and Thu sprint",
    "Ship small Atelier pieces",
    "PA YMCA States wins in breast; Nationals night final long-term",
  ],
  meetsNear: [
    "Tetrathlon Sep 26 UMLY (in-house — ask coach events)",
    "SJAC Fall Classic Oct 10–11 (first real USA time that mattered)",
    "Confirm Jan 15–17 meet before planning around it",
  ],
};

export function greetingLine(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function buildBriefing(date = new Date()) {
  const day = date.toLocaleDateString("en-US", { weekday: "long" });
  const swimHint = {
    Monday: "UMLY 6–8pm distance — homework window ~3:15–5:20 before practice.",
    Tuesday: "Tight commute: school out 2:50 → practice 4:00. Triage homework fast.",
    Wednesday: "VO2 night — protect it. Homework before 6pm; lights-out ~10:15–10:30.",
    Thursday: "Sprint threshold night — protect it. Homework before practice; lights-out ~10:15–10:30.",
    Friday: "Swim off. Optional upper lift later if the week felt survivable.",
    Saturday: "Practice 10am–12pm. Don't sleep till 10.",
    Sunday: "Off. Y 8am–4pm is no-touch for lifts.",
  }[day];

  return {
    title: `${greetingLine(date)}, ${PROFILE.name}.`,
    lines: [
      "Systems online. Profile loaded. No Grok Bot in the critical path.",
      swimHint || "Confirm today's swim status before we plan load.",
      `School stack: ${PROFILE.schoolDay.heavy.join(", ")}.`,
      `Homework after ${PROFILE.schoolDay.homeworkCutoff.split("—")[0].trim()} is junk — cut second subjects if you're late.`,
    ],
    tonight: [
      "Dump what's due (class + task).",
      "One AP deep block (25–40 min), then stop that subject.",
      "Pack tomorrow / suit if needed.",
      "Protect sleep — it's part of the assignment.",
    ],
  };
}
