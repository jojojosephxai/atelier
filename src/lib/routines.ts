import type { Climate, Formality, Season } from "./types";

export const ROUTINE_IDS = ["school", "weekend", "gym", "out"] as const;
export type RoutineId = (typeof ROUTINE_IDS)[number];

export type Routine = {
  id: RoutineId;
  label: string;
  blurb: string;
  occasion: Formality;
  description: string;
};

export const ROUTINES: Routine[] = [
  {
    id: "school",
    label: "School",
    blurb: "Classes, hallways, done.",
    occasion: "casual",
    description:
      "School day. Classes and walking campus. Comfortable, neat, not trying too hard. No suit. Jeans, tee or knit, sneakers or simple shoes. Carry a bag.",
  },
  {
    id: "weekend",
    label: "Weekend",
    blurb: "Errands, friends, nowhere formal.",
    occasion: "smart-casual",
    description:
      "Weekend out of the house. Coffee, errands, friends. Smart casual, easy layers, nothing that looks like a uniform.",
  },
  {
    id: "gym",
    label: "Gym",
    blurb: "Move, then leave.",
    occasion: "athletic",
    description:
      "Gym, PE, or a run. Athletic pieces only. Breathable, sneakers, nothing tailored.",
  },
  {
    id: "out",
    label: "Going out",
    blurb: "Evening, not a costume.",
    occasion: "smart-casual",
    description:
      "Going out with friends in the evening. A bit sharper than the usual day. Dinner or a show. No gym clothes.",
  },
];

export function routineById(id: RoutineId): Routine {
  return ROUTINES.find((r) => r.id === id) ?? ROUTINES[0];
}

export function defaultRoutine(date = new Date()): RoutineId {
  const day = date.getDay();
  const hour = date.getHours();
  if (day === 0 || day === 6) return "weekend";
  if (day === 5 && hour >= 16) return "weekend";
  return "school";
}

export function currentSeason(date = new Date()): Season {
  const m = date.getMonth();
  if (m <= 1 || m === 11) return "winter";
  if (m <= 4) return "spring";
  if (m <= 7) return "summer";
  return "fall";
}

export function daypart(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function weekdayLabel(date = new Date()): string {
  return date.toLocaleDateString(undefined, { weekday: "long" });
}

export const CLIMATE_CHIPS: Climate[] = [
  "hot",
  "warm",
  "mild",
  "cool",
  "cold",
  "rain",
];
