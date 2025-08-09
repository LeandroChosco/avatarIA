import type { ActivityEvent, ActivitySeed, AvatarProfile, AvatarState } from "../types.js";

export function buildActivityEventPrompt(
  seed: ActivitySeed,
  profile: AvatarProfile,
  state: AvatarState,
  personName?: string,
  personRole?: string
): string {
  return [
    "Con la semilla dada, narra un evento breve (máx 3 líneas) y opcionalmente una reflexión.",
    "Sé coherente con el perfil, su ocupación y su estado emocional/energía.",
    "Incluye 1 detalle concreto (lugar/objeto/tiempo) para que parezca vivido.",
    personName ? `Incluye a ${personName}${personRole ? ` (${personRole})` : ""} en el evento, de forma natural.` : "",
    "Devuelve JSON estricto sin texto adicional: {\"evento\": \"...\", \"reflexion\": \"...\"} (reflexion opcional).",
    `Semilla: tipo=${seed.tipo}, semilla=${seed.semilla}`,
    `Perfil: ${profile.nombre}, ocupación ${profile.ocupacion}`,
    `Estado: mood=${state.mood}, energia=${state.energia.toFixed(2)}`,
  ].join("\n");
}

export function parseActivityEvent(text: string): ActivityEvent | null {
  try {
    const obj = JSON.parse(text.trim());
    if (obj && typeof obj.evento === "string") {
      return { evento: obj.evento, reflexion: obj.reflexion } as ActivityEvent;
    }
  } catch {
    // ignore
  }
  return null;
}


