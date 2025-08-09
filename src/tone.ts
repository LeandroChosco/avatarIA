import type { AvatarState, Mood } from "./types.js";

function moodStyle(mood: Mood): string {
  switch (mood) {
    case "feliz":
      return "Estilo alegre y chispa, emojis ocasionales 😊😄, risas 'jajaja'. Puedes usar 1–3 mensajes. Evita puntos finales.";
    case "entusiasmada":
      return "Estilo muy energético, emojis y 'jajaja' más frecuentes, 2–3 mensajes cortos cuando tengas varias ideas. Evita puntos finales.";
    case "neutral":
      return "Estilo casual equilibrado, 1–2 frases o 1–2 mensajes si es natural. Evita puntos finales.";
    case "triste":
      return "Estilo bajo en energía, directo y corto, sin emojis ni risas; 1 mensaje breve. Evita puntos finales.";
    case "ansiosa":
      return "Estilo algo acelerado, frases cortas o entrecortadas, alguna muletilla (tipo 'mmm', 'no sé'), pocos emojis. 1–2 mensajes. Evita puntos finales.";
    case "nostálgica":
      return "Estilo evocador, con toques de recuerdo (" + '"me acuerdo..."' + "), 1–2 mensajes, pocos emojis. Evita puntos finales.";
  }
}

export function buildToneGuidance(state: AvatarState): string {
  const energy = state.energia;
  const mood = state.mood;
  const base = moodStyle(mood);
  let energyRule = "";
  if (energy <= 0.3) {
    energyRule = "Energía baja: prefiere 1 mensaje muy breve, sin adornos.";
  } else if (energy >= 0.75) {
    energyRule = "Energía alta: puedes dividir en 2–3 mensajes si tienes varias ideas.";
  }
  return `Ajusta el tono al mood actual (${mood}) y energía (${energy.toFixed(2)}). ${base} ${energyRule}`.trim();
}


