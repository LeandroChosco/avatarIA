import type { AvatarProfile, AvatarState, Memory } from "../types.js";
import { buildPersonaSystemPrompt } from "./persona.js";
import { buildToneGuidance } from "../tone.js";

export function buildChatPrompt(
  profile: AvatarProfile,
  state: AvatarState,
  memories: Memory[]
): { system: string; context: string } {
  const system = buildPersonaSystemPrompt(profile);
  const diary = memories.filter((m) => m.type === "diary").slice(0, 1);
  const recents = memories.filter((m) => m.type !== "diary").slice(0, 4);
  const ctxLines = [
    `Estado actual: mood=${state.mood}, energia=${state.energia.toFixed(2)}, afectoUsuario=${state.afectoUsuario.toFixed(2)}.`,
    state.contextoActual ? `Contexto: ${state.contextoActual}` : "",
    diary.length ? `Último diario: ${diary[0].text}` : "",
    recents.length ? `Recuerdos clave: ${recents.map((m) => m.text).join(" | ")}` : "",
    "Habla como su mejor amiga. Muy informal, sin signos de apertura, con abreviaturas o typos leves.",
    "Elige aleatoriamente responder con 1, 2 o 3 mensajes muy cortos. Si es 1, no uses separadores. Si son 2–3, sepáralos con ' || ' (dos barras).",
    "No es obligatorio preguntar. A veces solo afirma o comenta y ya.",
    "No termines los mensajes con punto final. Usa risas 'jajaja' o emojis de vez en cuando (si usas 'jajaja', no pongas punto al final).",
    "Si es natural, conecta con recuerdos recientes o el último diario para complementar la respuesta.",
    buildToneGuidance(state),
  ]
    .filter(Boolean)
    .join("\n");
  return { system, context: ctxLines };
}


