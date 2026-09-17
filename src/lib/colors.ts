export const FASHION_PALETTE: { name: string; hex: string }[] = [
  { name: "Ivory", hex: "#f3eee4" },
  { name: "White", hex: "#f7f7f4" },
  { name: "Bone", hex: "#e6dcc8" },
  { name: "Sand", hex: "#c4b49a" },
  { name: "Camel", hex: "#b08a5b" },
  { name: "Khaki", hex: "#9a8f6e" },
  { name: "Oak", hex: "#6b4a2e" },
  { name: "Espresso", hex: "#3b2a22" },
  { name: "Black", hex: "#1a1a1a" },
  { name: "Charcoal", hex: "#3a3a3c" },
  { name: "Grey", hex: "#8a8a8a" },
  { name: "Stone", hex: "#a39e93" },
  { name: "Navy", hex: "#1c2a4a" },
  { name: "Indigo", hex: "#2c3a6a" },
  { name: "Steel", hex: "#5c6b7a" },
  { name: "Olive", hex: "#5c6040" },
  { name: "Forest", hex: "#2f4a3a" },
  { name: "Burgundy", hex: "#6b2c38" },
  { name: "Wine", hex: "#4a1c28" },
  { name: "Rust", hex: "#8a4a32" },
];

export function nearestPaletteName(hex: string): string {
  const n = hex.replace("#", "").toLowerCase();
  const found = FASHION_PALETTE.find((p) => p.hex.replace("#", "").toLowerCase() === n);
  if (found) return found.name;
  return "Custom";
}
