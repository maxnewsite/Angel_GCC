// Models selectable for analysis. Shared by the API route and the admin UI.

export const DEFAULT_MODEL = "claude-haiku-5-5";

export const MODELS = [
  { id: "claude-haiku-5-5", name: "Haiku 5.5", tagline: "Fast & Efficient", description: "Best for bulk screening, lowest cost" },
  { id: "claude-sonnet-4-6", name: "Sonnet 4.6", tagline: "Balanced", description: "Great balance of quality and speed" },
  { id: "claude-opus-4-6", name: "Opus 4.6", tagline: "Most Capable", description: "Highest quality, best for key decisions" },
] as const;

// Older clients and stored selections may still send a Haiku 4.5 id
const LEGACY_ALIASES: Record<string, string> = {
  "claude-haiku-4-5": "claude-haiku-5-5",
  "claude-haiku-4-5-20251001": "claude-haiku-5-5",
};

export function resolveModel(model: unknown): string {
  if (typeof model !== "string") return DEFAULT_MODEL;
  const id = LEGACY_ALIASES[model] ?? model;
  return MODELS.some((m) => m.id === id) ? id : DEFAULT_MODEL;
}
