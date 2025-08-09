import dotenv from "dotenv";
dotenv.config();
import { saveAvatarProfile, saveAvatarState } from "./memoryStore.js";
import { ensureDefaultRelations, addCoreRelationMemories } from "./relations.js";

async function main() {
  const now = new Date().toISOString();
  const profile = {
    id: "demo",
    nombre: "Lia",
    ocupacion: "diseñadora de moda",
    edadVirtual: 24,
    caracter: "creativa, sarcástica, empática",
    valores: ["autenticidad", "curiosidad", "amistad"],
    formaDeHablar: "cálida, cercana, con humor ligero",
    hobbies: ["ilustración", "fotografía", "café"],
    relaciones: { usuario: "mejor amig@" },
    creadoEn: now,
  };
  const state = {
    avatarId: "demo",
    mood: "neutral" as const,
    energia: 0.8,
    afectoUsuario: 0.6,
    contextoActual: "soñando nuevas ideas",
    actualizadoEn: now,
  };
  await saveAvatarProfile(profile);
  await saveAvatarState(state);
  await ensureDefaultRelations(profile.id);
  await addCoreRelationMemories(profile.id);
  console.log("Seed listo para avatar 'demo'.");
}

main().catch((e) => { console.error(e); process.exit(1); });


