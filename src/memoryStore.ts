import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { v4 as uuidv4 } from "uuid";
import type { AvatarProfile, AvatarState, Memory, Person, Relationship, RelationshipType } from "./types.js";
import { embed, cosineSim } from "./embeddings.js";

const useFirestore = !!(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_PROJECT_ID || process.env.VERCEL);

// Resolve project root reliably for both src (ts-node) and dist (compiled)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// memoryStore.ts lives in: src/ (dev) or dist/ (prod). Going up 1 level hits the project root
const projectRoot = path.resolve(__dirname, "..");
const defaultServiceKeyPath = path.join(projectRoot, "services-firebase.json");

const JSON_FILES = {
  avatars: path.join(projectRoot, "avatars.json"),
  states: path.join(projectRoot, "states.json"),
  memories: path.join(projectRoot, "memories.json"),
  persons: path.join(projectRoot, "persons.json"),
  relationships: path.join(projectRoot, "relationships.json"),
};

type Store = {
  getOrCreateAvatar(avatarId: string): Promise<{ profile: AvatarProfile; state: AvatarState }>;
  saveAvatarProfile(profile: AvatarProfile): Promise<void>;
  saveAvatarState(state: AvatarState): Promise<void>;
  addMemory(mem: Memory): Promise<void>;
  getRecentMemories(avatarId: string, limit: number): Promise<Memory[]>;
  getTopKMemoriesByEmbedding(avatarId: string, query: string, k: number): Promise<Memory[]>;
  getLastSeeds(avatarId: string, limit: number): Promise<string[]>;
  getAllAvatarProfiles(): Promise<AvatarProfile[]>;
  // Personas y relaciones
  upsertPersonByName(avatarId: string, nombre: string, rol?: string): Promise<Person>;
  getPersonByName(avatarId: string, nombre: string): Promise<Person | undefined>;
  getPeople(avatarId: string): Promise<Person[]>;
  upsertRelationship(
    avatarId: string,
    personId: string,
    tipo: RelationshipType,
    deltaCercania?: number,
    ultimoEvento?: string
  ): Promise<Relationship>;
  getRelationships(avatarId: string): Promise<Relationship[]>;
};

async function ensureFile(filePath: string, defaultContent: string) {
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, defaultContent, "utf8");
  }
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return content.trim() ? (JSON.parse(content) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(filePath: string, data: T): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

class JsonStore implements Store {
  async init() {
    await ensureFile(JSON_FILES.avatars, "[]\n");
    await ensureFile(JSON_FILES.states, "[]\n");
    await ensureFile(JSON_FILES.memories, "[]\n");
    await ensureFile(JSON_FILES.persons, "[]\n");
    await ensureFile(JSON_FILES.relationships, "[]\n");
  }

  async getAllAvatarProfiles(): Promise<AvatarProfile[]> {
    await this.init();
    const avatars = await readJson<AvatarProfile[]>(JSON_FILES.avatars, []);
    return avatars;
  }

  async getOrCreateAvatar(avatarId: string): Promise<{ profile: AvatarProfile; state: AvatarState }> {
    await this.init();
    const avatars = await readJson<AvatarProfile[]>(JSON_FILES.avatars, []);
    const states = await readJson<AvatarState[]>(JSON_FILES.states, []);
    let profile = avatars.find((a) => a.id === avatarId);
    let state = states.find((s) => s.avatarId === avatarId);
    const now = new Date().toISOString();
    if (!profile) {
      profile = {
        id: avatarId,
        nombre: avatarId,
        ocupacion: "diseñadora de moda",
        edadVirtual: 24,
        caracter: "creativa, sarcástica, empática",
        valores: ["autenticidad", "curiosidad", "amistad"],
        formaDeHablar: "cálida, con humor ligero y cercanía",
        hobbies: ["ilustración", "fotografía", "café"],
        relaciones: {},
        creadoEn: now,
      };
      // Perfiles predefinidos
      const idLower = avatarId.toLowerCase();
      if (idLower === "julio") {
        profile = {
          id: avatarId,
          nombre: "Julio",
          ocupacion: "profesor de idiomas",
          edadVirtual: 31,
          caracter: "elocuente, carismático, curioso",
          valores: ["aprendizaje", "humor", "curiosidad"],
          formaDeHablar: "humorístico, con frases de películas, ingenioso",
          hobbies: ["cine", "lenguas", "lectura"],
          relaciones: {},
          creadoEn: now,
        };
      } else if (idLower === "lucia" || idLower === "lucía") {
        profile = {
          id: avatarId,
          nombre: "Lucia",
          ocupacion: "vendedora de ropa",
          edadVirtual: 27,
          caracter: "directa, buena comunicadora, honesta, ligeramente brusca",
          valores: ["honestidad", "agilidad", "humor"],
          formaDeHablar: "honesta, con chistes para romper el hielo, ligeramente brusca a veces",
          hobbies: ["moda", "ventas", "redes"],
          relaciones: {},
          creadoEn: now,
        };
      }
      avatars.push(profile);
      await writeJson(JSON_FILES.avatars, avatars);
    }
    if (!state) {
      state = {
        avatarId,
        mood: "neutral",
        energia: 0.8,
        afectoUsuario: 0.5,
        contextoActual: "pensando en nuevas ideas",
        actualizadoEn: now,
      };
      states.push(state);
      await writeJson(JSON_FILES.states, states);
    }
    return { profile, state };
  }

  async saveAvatarProfile(profile: AvatarProfile): Promise<void> {
    await this.init();
    const avatars = await readJson<AvatarProfile[]>(JSON_FILES.avatars, []);
    const idx = avatars.findIndex((a) => a.id === profile.id);
    if (idx >= 0) avatars[idx] = profile; else avatars.push(profile);
    await writeJson(JSON_FILES.avatars, avatars);
  }

  async saveAvatarState(state: AvatarState): Promise<void> {
    await this.init();
    const states = await readJson<AvatarState[]>(JSON_FILES.states, []);
    const idx = states.findIndex((s) => s.avatarId === state.avatarId);
    if (idx >= 0) states[idx] = state; else states.push(state);
    await writeJson(JSON_FILES.states, states);
  }

  async addMemory(mem: Memory): Promise<void> {
    await this.init();
    const memories = await readJson<Memory[]>(JSON_FILES.memories, []);
    memories.push(mem);
    await writeJson(JSON_FILES.memories, memories);
  }

  async getRecentMemories(avatarId: string, limit: number): Promise<Memory[]> {
    await this.init();
    const memories = await readJson<Memory[]>(JSON_FILES.memories, []);
    return memories
      .filter((m) => m.avatarId === avatarId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async getTopKMemoriesByEmbedding(avatarId: string, query: string, k: number): Promise<Memory[]> {
    await this.init();
    const memories = await readJson<Memory[]>(JSON_FILES.memories, []);
    const candidate = memories
      .filter((m) => m.avatarId === avatarId)
      .slice(-200); // last 200
    const queryEmbedding = await embed(query);
    if (queryEmbedding.length === 0) {
      return candidate.slice(-k).reverse();
    }
    // ensure embeddings
    for (const m of candidate) {
      if (!m.embedding) m.embedding = await embed(m.text);
    }
    type Scored = { m: Memory; score: number };
    const scored = candidate
      .map((m: Memory): Scored => ({ m, score: m.embedding ? cosineSim(queryEmbedding, m.embedding) : 0 }))
      .sort((a: Scored, b: Scored) => b.score - a.score)
      .slice(0, k)
      .map((s: Scored) => s.m);
    return scored;
  }

  async getLastSeeds(avatarId: string, limit: number): Promise<string[]> {
    await this.init();
    const memories = await readJson<Memory[]>(JSON_FILES.memories, []);
    const seeds = memories
      .filter((m: Memory) => m.avatarId === avatarId && m.type === "preference" && (m.tags || []).includes("seed"))
      .sort((a: Memory, b: Memory) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map((m: Memory) => m.text);
    return seeds;
  }

  async upsertPersonByName(avatarId: string, nombre: string, rol?: string): Promise<Person> {
    await this.init();
    const now = new Date().toISOString();
    const people = await readJson<Person[]>(JSON_FILES.persons, []);
    const norm = nombre.trim();
    let p = people.find((x) => x.avatarId === avatarId && x.nombre.toLowerCase() === norm.toLowerCase());
    if (!p) {
      p = { id: uuidv4(), avatarId, nombre: norm, rol, creadoEn: now, actualizadoEn: now };
      people.push(p);
    } else {
      if (rol && !p.rol) p.rol = rol;
      p.actualizadoEn = now;
    }
    await writeJson(JSON_FILES.persons, people);
    return p;
  }

  async getPersonByName(avatarId: string, nombre: string): Promise<Person | undefined> {
    await this.init();
    const people = await readJson<Person[]>(JSON_FILES.persons, []);
    return people.find((x) => x.avatarId === avatarId && x.nombre.toLowerCase() === nombre.trim().toLowerCase());
  }

  async getPeople(avatarId: string): Promise<Person[]> {
    await this.init();
    const people = await readJson<Person[]>(JSON_FILES.persons, []);
    return people.filter((p) => p.avatarId === avatarId);
  }

  async upsertRelationship(
    avatarId: string,
    personId: string,
    tipo: RelationshipType,
    deltaCercania: number = 0,
    ultimoEvento?: string
  ): Promise<Relationship> {
    await this.init();
    const now = new Date().toISOString();
    const rels = await readJson<Relationship[]>(JSON_FILES.relationships, []);
    let r = rels.find((x) => x.avatarId === avatarId && x.personId === personId && x.tipo === tipo);
    if (!r) {
      r = { id: uuidv4(), avatarId, personId, tipo, cercania: Math.max(0, Math.min(1, 0.5 + deltaCercania)), actualizadoEn: now, ultimoEvento };
      rels.push(r);
    } else {
      r.cercania = Math.max(0, Math.min(1, r.cercania + deltaCercania));
      if (ultimoEvento) r.ultimoEvento = ultimoEvento;
      r.actualizadoEn = now;
    }
    await writeJson(JSON_FILES.relationships, rels);
    return r;
  }

  async getRelationships(avatarId: string): Promise<Relationship[]> {
    await this.init();
    const rels = await readJson<Relationship[]>(JSON_FILES.relationships, []);
    return rels.filter((r) => r.avatarId === avatarId);
  }
}

class FirestoreStore implements Store {
  private firestore: any;
  private avatarsCol: any;
  private statesCol: any;
  private memoriesCol: any;
  private personsCol: any;
  private relationshipsCol: any;

  constructor() {
    // Lazy import to avoid bundling if not used
    const { Firestore } = require("@google-cloud/firestore");
    const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || defaultServiceKeyPath;
    const hasKeyFile = (() => { try { require("fs").accessSync(keyPath); return true; } catch { return false; } })();
    const options: any = { projectId: process.env.FIREBASE_PROJECT_ID };
    if (hasKeyFile) options.keyFilename = keyPath;
    this.firestore = new Firestore(options);
    this.avatarsCol = this.firestore.collection("avatars");
    this.statesCol = this.firestore.collection("states");
    this.memoriesCol = this.firestore.collection("memories");
    this.personsCol = this.firestore.collection("persons");
    this.relationshipsCol = this.firestore.collection("relationships");
  }

  async getAllAvatarProfiles(): Promise<AvatarProfile[]> {
    const snap = await this.avatarsCol.get();
    return snap.docs.map((d: any) => d.data() as AvatarProfile);
  }

  async getOrCreateAvatar(avatarId: string): Promise<{ profile: AvatarProfile; state: AvatarState }> {
    const now = new Date().toISOString();
    const profileRef = this.avatarsCol.doc(avatarId);
    const stateRef = this.statesCol.doc(avatarId);
    const [pDoc, sDoc] = await Promise.all([profileRef.get(), stateRef.get()]);
    let profile = pDoc.exists ? (pDoc.data() as AvatarProfile) : undefined;
    let state = sDoc.exists ? (sDoc.data() as AvatarState) : undefined;
    if (!profile) {
      // Perfil por defecto + overrides para ids conocidos
      const idLower = avatarId.toLowerCase();
      if (idLower === "julio") {
        profile = {
          id: avatarId,
          nombre: "Julio",
          ocupacion: "profesor de idiomas",
          edadVirtual: 31,
          caracter: "elocuente, carismático, curioso",
          valores: ["aprendizaje", "humor", "curiosidad"],
          formaDeHablar: "humorístico, con frases de películas, ingenioso",
          hobbies: ["cine", "lenguas", "lectura"],
          relaciones: {},
          creadoEn: now,
        };
      } else if (idLower === "lucia" || idLower === "lucía") {
        profile = {
          id: avatarId,
          nombre: "Lucia",
          ocupacion: "vendedora de ropa",
          edadVirtual: 27,
          caracter: "directa, buena comunicadora, honesta, ligeramente brusca",
          valores: ["honestidad", "agilidad", "humor"],
          formaDeHablar: "honesta, con chistes para romper el hielo, ligeramente brusca a veces",
          hobbies: ["moda", "ventas", "redes"],
          relaciones: {},
          creadoEn: now,
        };
      } else {
        profile = {
          id: avatarId,
          nombre: avatarId,
          ocupacion: "diseñadora de moda",
          edadVirtual: 24,
          caracter: "creativa, sarcástica, empática",
          valores: ["autenticidad", "curiosidad", "amistad"],
          formaDeHablar: "cálida, con humor ligero y cercanía",
          hobbies: ["ilustración", "fotografía", "café"],
          relaciones: {},
          creadoEn: now,
        };
      }
      await profileRef.set(profile);
    }
    if (!state) {
      state = {
        avatarId,
        mood: "neutral",
        energia: 0.8,
        afectoUsuario: 0.5,
        contextoActual: "pensando en nuevas ideas",
        actualizadoEn: now,
      };
      await stateRef.set(state);
    }
    return { profile, state };
  }

  async saveAvatarProfile(profile: AvatarProfile): Promise<void> {
    await this.avatarsCol.doc(profile.id).set(profile);
  }

  async saveAvatarState(state: AvatarState): Promise<void> {
    await this.statesCol.doc(state.avatarId).set(state);
  }

  async addMemory(mem: Memory): Promise<void> {
    await this.memoriesCol.doc(mem.id).set(mem);
  }

  async getRecentMemories(avatarId: string, limit: number): Promise<Memory[]> {
    const snap = await this.memoriesCol
      .where("avatarId", "==", avatarId)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    return snap.docs.map((d: any) => d.data() as Memory);
  }

  async getTopKMemoriesByEmbedding(avatarId: string, query: string, k: number): Promise<Memory[]> {
    // Firestore cannot do vector search natively; fetch last N and rank locally
    const snap = await this.memoriesCol
      .where("avatarId", "==", avatarId)
      .orderBy("createdAt", "desc")
      .limit(200)
      .get();
    const candidates = snap.docs.map((d: any) => d.data() as Memory);
    const queryEmbedding = await embed(query);
    if (queryEmbedding.length === 0) return candidates.slice(0, k);
    for (const m of candidates) {
      if (!m.embedding) m.embedding = await embed(m.text);
    }
    type Scored = { m: Memory; score: number };
    const scored = candidates
      .map((m: Memory): Scored => ({ m, score: m.embedding ? cosineSim(queryEmbedding, m.embedding) : 0 }))
      .sort((a: Scored, b: Scored) => b.score - a.score)
      .slice(0, k)
      .map((s: Scored) => s.m);
    return scored;
  }

  async getLastSeeds(avatarId: string, limit: number): Promise<string[]> {
    const snap = await this.memoriesCol
      .where("avatarId", "==", avatarId)
      .where("type", "==", "preference")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    const all = snap.docs.map((d: any) => d.data() as Memory);
    const seeds = all
      .filter((m: Memory) => (m.tags || []).includes("seed"))
      .map((m: Memory) => m.text);
    return seeds;
  }

  async upsertPersonByName(avatarId: string, nombre: string, rol?: string): Promise<Person> {
    const norm = nombre.trim();
    const snap = await this.personsCol
      .where("avatarId", "==", avatarId)
      .where("nombre_lower", "==", norm.toLowerCase())
      .limit(1)
      .get();
    const now = new Date().toISOString();
    if (!snap.empty) {
      const doc = snap.docs[0];
      const p = doc.data() as Person & { nombre_lower?: string };
      if (rol && !p.rol) p.rol = rol;
      p.actualizadoEn = now;
      await doc.ref.set({ ...p, nombre_lower: p.nombre.toLowerCase() });
      return p;
    }
    const id = uuidv4();
    const p: Person & { nombre_lower?: string } = { id, avatarId, nombre: norm, rol, creadoEn: now, actualizadoEn: now, nombre_lower: norm.toLowerCase() };
    await this.personsCol.doc(id).set(p);
    delete (p as any).nombre_lower;
    return p as Person;
  }

  async getPersonByName(avatarId: string, nombre: string): Promise<Person | undefined> {
    const norm = nombre.trim().toLowerCase();
    const snap = await this.personsCol
      .where("avatarId", "==", avatarId)
      .where("nombre_lower", "==", norm)
      .limit(1)
      .get();
    if (snap.empty) return undefined;
    const p = snap.docs[0].data() as Person;
    return p;
  }

  async getPeople(avatarId: string): Promise<Person[]> {
    const snap = await this.personsCol.where("avatarId", "==", avatarId).get();
    return snap.docs.map((d: any) => d.data() as Person);
  }

  async upsertRelationship(
    avatarId: string,
    personId: string,
    tipo: RelationshipType,
    deltaCercania: number = 0,
    ultimoEvento?: string
  ): Promise<Relationship> {
    const q = await this.relationshipsCol
      .where("avatarId", "==", avatarId)
      .where("personId", "==", personId)
      .where("tipo", "==", tipo)
      .limit(1)
      .get();
    const now = new Date().toISOString();
    if (q.empty) {
      const id = uuidv4();
      const r: Relationship = { id, avatarId, personId, tipo, cercania: Math.max(0, Math.min(1, 0.5 + deltaCercania)), actualizadoEn: now, ultimoEvento };
      await this.relationshipsCol.doc(id).set(r);
      return r;
    }
    const doc = q.docs[0];
    const r = doc.data() as Relationship;
    r.cercania = Math.max(0, Math.min(1, r.cercania + deltaCercania));
    if (ultimoEvento) r.ultimoEvento = ultimoEvento;
    r.actualizadoEn = now;
    await doc.ref.set(r);
    return r;
  }

  async getRelationships(avatarId: string): Promise<Relationship[]> {
    const snap = await this.relationshipsCol.where("avatarId", "==", avatarId).get();
    return snap.docs.map((d: any) => d.data() as Relationship);
  }
}

const store: Store = useFirestore ? new FirestoreStore() : new JsonStore();

export async function getOrCreateAvatar(avatarId: string) {
  return store.getOrCreateAvatar(avatarId);
}

export async function saveAvatarProfile(profile: AvatarProfile) {
  return store.saveAvatarProfile(profile);
}

export async function saveAvatarState(state: AvatarState) {
  return store.saveAvatarState(state);
}

export async function addMemory(mem: Omit<Memory, "id" | "createdAt"> & Partial<Pick<Memory, "id" | "createdAt">>) {
  const withIds: Memory = {
    id: mem.id || uuidv4(),
    createdAt: mem.createdAt || new Date().toISOString(),
    ...mem,
  } as Memory;
  return store.addMemory(withIds);
}

export async function getRecentMemories(avatarId: string, limit: number) {
  return store.getRecentMemories(avatarId, limit);
}

export async function getTopKMemoriesByEmbedding(avatarId: string, query: string, k: number) {
  return store.getTopKMemoriesByEmbedding(avatarId, query, k);
}

export async function getLastSeeds(avatarId: string, limit: number) {
  return store.getLastSeeds(avatarId, limit);
}

export async function getAllAvatarProfiles() {
  return store.getAllAvatarProfiles();
}

// Personas y relaciones
export async function upsertPersonByName(avatarId: string, nombre: string, rol?: string) {
  return store.upsertPersonByName(avatarId, nombre, rol);
}
export async function getPersonByName(avatarId: string, nombre: string) {
  return store.getPersonByName(avatarId, nombre);
}
export async function getPeople(avatarId: string) {
  return store.getPeople(avatarId);
}
export async function upsertRelationship(
  avatarId: string,
  personId: string,
  tipo: RelationshipType,
  deltaCercania?: number,
  ultimoEvento?: string
) {
  return store.upsertRelationship(avatarId, personId, tipo, deltaCercania, ultimoEvento);
}
export async function getRelationships(avatarId: string) {
  return store.getRelationships(avatarId);
}


