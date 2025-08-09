import OpenAI from "openai";
import { OPENAI_API_KEY_FALLBACK } from "./localSecrets.js";
import type { ActivityEvent, ActivitySeed, AvatarProfile, AvatarState, Mood } from "./types.js";
import { addMemory, getAllAvatarProfiles, getLastSeeds, getOrCreateAvatar, saveAvatarState, getPeople, upsertRelationship } from "./memoryStore.js";
import { addNotification } from "./notifyStore.js";
import { buildActivitySeedPrompt, parseActivitySeed } from "./prompts/activitySeed.js";
import { buildActivityEventPrompt, parseActivityEvent } from "./prompts/activityEvent.js";

function getOpenAIKey(): string | undefined {
  return process.env.OPENAI_API_KEY || OPENAI_API_KEY_FALLBACK;
}
const modelCheap = process.env.MODEL_CHEAP || "gpt-4o-mini";

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]!; }

function heuristicSeed(profile: AvatarProfile, state: AvatarState, lastSeeds: string[]): ActivitySeed {
  const types: ActivitySeed["tipo"][] = ["profesional", "social", "hobby", "emocional"];
  let tipo = rand(types);
  // Simple tendency based on energy and mood
  if (state.energia < 0.3) tipo = rand(["emocional", "hobby"]);
  if (state.mood === "entusiasmada") tipo = rand(["profesional", "social"]);
  let semilla = "";
  switch (tipo) {
    case "profesional":
      semilla = `avanzar en ${profile.ocupacion} (bocetos/ideas)`;
      break;
    case "social":
      semilla = "enviar un mensaje cariñoso a un amigo";
      break;
    case "hobby":
      semilla = `practicar ${rand(profile.hobbies)}`;
      break;
    case "emocional":
      semilla = "hacer journaling de 10 minutos";
      break;
  }
  // Avoid last seeds
  let tries = 0;
  while (lastSeeds.includes(semilla) && tries++ < 3) {
    semilla += " ✳";
  }
  return { tipo, semilla };
}

function heuristicEvent(seed: ActivitySeed, profile: AvatarProfile, state: AvatarState): ActivityEvent {
  const evento = `Hoy ${profile.nombre} decidió ${seed.semilla}. Salió ${state.mood === "triste" ? "regular" : "bastante bien"}.`;
  const reflexion = state.energia < 0.4 ? "Me faltó energía, pero me siento satisfecha por intentarlo." : undefined;
  return { evento, reflexion };
}

export async function generateDailySeed(profile: AvatarProfile, state: AvatarState, lastSeeds: string[]): Promise<ActivitySeed> {
  const openaiApiKey = getOpenAIKey();
  if (!openaiApiKey) return heuristicSeed(profile, state, lastSeeds);
  const client = new OpenAI({ apiKey: openaiApiKey });
  const prompt = buildActivitySeedPrompt(profile, state, lastSeeds);
  const res = await client.chat.completions.create({
    model: modelCheap,
    messages: [
      { role: "system", content: "Eres un generador de JSON estricto." },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
  });
  const text = res.choices[0]?.message?.content || "";
  return parseActivitySeed(text) || heuristicSeed(profile, state, lastSeeds);
}

export async function generateEventFromSeed(seed: ActivitySeed, profile: AvatarProfile, state: AvatarState, personName?: string, personRole?: string): Promise<ActivityEvent> {
  const openaiApiKey = getOpenAIKey();
  if (!openaiApiKey) return heuristicEvent(seed, profile, state);
  const client = new OpenAI({ apiKey: openaiApiKey });
  const prompt = buildActivityEventPrompt(seed, profile, state, personName, personRole);
  const res = await client.chat.completions.create({
    model: modelCheap,
    messages: [
      { role: "system", content: "Devuelve JSON estricto y nada más." },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
  });
  const text = res.choices[0]?.message?.content || "";
  return parseActivityEvent(text) || heuristicEvent(seed, profile, state);
}

export function applyEventToState(event: ActivityEvent, state: AvatarState): AvatarState {
  const text = `${event.evento} ${event.reflexion || ""}`.toLowerCase();
  let mood: Mood = state.mood;
  let energia = state.energia;
  if (/profesional|avanz|proyecto|colecci/.test(text)) {
    mood = "entusiasmada";
    energia = Math.max(0, energia - 0.05);
  }
  if (/trist|nostal|mal|cansad/.test(text)) {
    mood = text.includes("trist") ? "triste" : mood;
    energia = Math.max(0, energia - 0.1);
  }
  if (/social|amig|charl|mensaje/.test(text)) {
    mood = mood === "triste" ? "neutral" : "feliz";
    energia = Math.max(0, energia - 0.03);
  }
  return {
    ...state,
    mood,
    energia: Math.min(1, Math.max(0, energia)),
    contextoActual: event.evento.slice(0, 80),
    actualizadoEn: new Date().toISOString(),
  };
}

export async function tickAllAvatars(): Promise<number> {
  const profiles = await getAllAvatarProfiles();
  let processed = 0;
  for (const profile of profiles) {
    const { state } = await getOrCreateAvatar(profile.id);
    // Selecciona persona para eventos sociales si existen
    const people = await getPeople(profile.id);
    const maybePerson = people.length ? rand(people) : undefined;
    const lastSeeds = await getLastSeeds(profile.id, 5);
    const seed = await generateDailySeed(profile, state, lastSeeds);
    const event = await generateEventFromSeed(seed, profile, state, maybePerson?.nombre, maybePerson?.rol);
    const newState = applyEventToState(event, state);
    await saveAvatarState(newState);
    // Save seed for avoidance
    await addMemory({
      avatarId: profile.id,
      type: "preference",
      text: seed.semilla,
      salience: 0.4,
      tags: ["seed"],
    });
    // Save diary memory
    await addMemory({
      avatarId: profile.id,
      type: "diary",
      text: event.reflexion ? `${event.evento} \nReflexión: ${event.reflexion}` : event.evento,
      salience: 0.7,
      tags: ["diary"],
      entityRefs: maybePerson ? [maybePerson.id] : undefined,
    });
    if (maybePerson) {
      await upsertRelationship(profile.id, maybePerson.id, "amistad", 0.02, `Actividad con ${maybePerson.nombre}`);
    }
    // Genera mensaje espontáneo para próxima interacción
    const spontaneous: string[] = [];
    if (maybePerson) {
      const variants = [
        (n: string) => `anduve con ${n} hace un rato, salió algo random jajaja`,
        (n: string) => `me crucé con ${n} y termino en una mini odisea`,
        (n: string) => `estuve con ${n} y hubo un detalle q te va a encantar`,
        (n: string) => `lo de hoy con ${n} estuvo fuerte pero lindo`,
      ];
      const v = variants[Math.floor(Math.random() * variants.length)];
      spontaneous.push(v(maybePerson.nombre));
    }
    if (newState.mood === "entusiasmada") spontaneous.push("ando con mil ideas en la cabeza");
    if (spontaneous.length) await addNotification(profile.id, spontaneous);
    processed++;
  }
  return processed;
}


