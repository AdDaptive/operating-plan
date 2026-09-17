const AVATAR_COLORS = ["#2D6CDF", "#7C3AED", "#DC6803", "#0E9384", "#DB2777", "#B45309"];

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function colorForName(name: string) {
  const idx = name.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}
