import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { v4 as uuidv4 } from "uuid";
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
async function ensureFile(filePath, defaultContent) {
    try {
        await fs.access(filePath);
    }
    catch {
        await fs.writeFile(filePath, defaultContent, "utf8");
    }
}
async function readJson(filePath, fallback) {
    try {
        const content = await fs.readFile(filePath, "utf8");
        return content.trim() ? JSON.parse(content) : fallback;
    }
    catch {
        return fallback;
    }
}
async function writeJson(filePath, data) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}
class JsonStore {
    async init() {
        await ensureFile(JSON_FILES.avatars, "[]\n");
        await ensureFile(JSON_FILES.states, "[]\n");
        await ensureFile(JSON_FILES.memories, "[]\n");
        await ensureFile(JSON_FILES.persons, "[]\n");
        await ensureFile(JSON_FILES.relationships, "[]\n");
    }
    async getAllAvatarProfiles() {
        await this.init();
        const avatars = await readJson(JSON_FILES.avatars, []);
        return avatars;
    }
    async getOrCreateAvatar(avatarId) {
        await this.init();
        const avatars = await readJson(JSON_FILES.avatars, []);
        const states = await readJson(JSON_FILES.states, []);
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
            }
            else if (idLower === "lucia" || idLower === "lucía") {
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
    async saveAvatarProfile(profile) {
        await this.init();
        const avatars = await readJson(JSON_FILES.avatars, []);
        const idx = avatars.findIndex((a) => a.id === profile.id);
        if (idx >= 0)
            avatars[idx] = profile;
        else
            avatars.push(profile);
        await writeJson(JSON_FILES.avatars, avatars);
    }
    async saveAvatarState(state) {
        await this.init();
        const states = await readJson(JSON_FILES.states, []);
        const idx = states.findIndex((s) => s.avatarId === state.avatarId);
        if (idx >= 0)
            states[idx] = state;
        else
            states.push(state);
        await writeJson(JSON_FILES.states, states);
    }
    async addMemory(mem) {
        await this.init();
        const memories = await readJson(JSON_FILES.memories, []);
        memories.push(mem);
        await writeJson(JSON_FILES.memories, memories);
    }
    async getRecentMemories(avatarId, limit) {
        await this.init();
        const memories = await readJson(JSON_FILES.memories, []);
        return memories
            .filter((m) => m.avatarId === avatarId)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, limit);
    }
    async getTopKMemoriesByEmbedding(avatarId, query, k) {
        await this.init();
        const memories = await readJson(JSON_FILES.memories, []);
        const candidate = memories
            .filter((m) => m.avatarId === avatarId)
            .slice(-200); // last 200
        const queryEmbedding = await embed(query);
        if (queryEmbedding.length === 0) {
            return candidate.slice(-k).reverse();
        }
        // ensure embeddings
        for (const m of candidate) {
            if (!m.embedding)
                m.embedding = await embed(m.text);
        }
        const scored = candidate
            .map((m) => ({ m, score: m.embedding ? cosineSim(queryEmbedding, m.embedding) : 0 }))
            .sort((a, b) => b.score - a.score)
            .slice(0, k)
            .map((s) => s.m);
        return scored;
    }
    async getLastSeeds(avatarId, limit) {
        await this.init();
        const memories = await readJson(JSON_FILES.memories, []);
        const seeds = memories
            .filter((m) => m.avatarId === avatarId && m.type === "preference" && (m.tags || []).includes("seed"))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, limit)
            .map((m) => m.text);
        return seeds;
    }
    async upsertPersonByName(avatarId, nombre, rol) {
        await this.init();
        const now = new Date().toISOString();
        const people = await readJson(JSON_FILES.persons, []);
        const norm = nombre.trim();
        let p = people.find((x) => x.avatarId === avatarId && x.nombre.toLowerCase() === norm.toLowerCase());
        if (!p) {
            p = { id: uuidv4(), avatarId, nombre: norm, rol, creadoEn: now, actualizadoEn: now };
            people.push(p);
        }
        else {
            if (rol && !p.rol)
                p.rol = rol;
            p.actualizadoEn = now;
        }
        await writeJson(JSON_FILES.persons, people);
        return p;
    }
    async getPersonByName(avatarId, nombre) {
        await this.init();
        const people = await readJson(JSON_FILES.persons, []);
        return people.find((x) => x.avatarId === avatarId && x.nombre.toLowerCase() === nombre.trim().toLowerCase());
    }
    async getPeople(avatarId) {
        await this.init();
        const people = await readJson(JSON_FILES.persons, []);
        return people.filter((p) => p.avatarId === avatarId);
    }
    async upsertRelationship(avatarId, personId, tipo, deltaCercania = 0, ultimoEvento) {
        await this.init();
        const now = new Date().toISOString();
        const rels = await readJson(JSON_FILES.relationships, []);
        let r = rels.find((x) => x.avatarId === avatarId && x.personId === personId && x.tipo === tipo);
        if (!r) {
            r = { id: uuidv4(), avatarId, personId, tipo, cercania: Math.max(0, Math.min(1, 0.5 + deltaCercania)), actualizadoEn: now, ultimoEvento };
            rels.push(r);
        }
        else {
            r.cercania = Math.max(0, Math.min(1, r.cercania + deltaCercania));
            if (ultimoEvento)
                r.ultimoEvento = ultimoEvento;
            r.actualizadoEn = now;
        }
        await writeJson(JSON_FILES.relationships, rels);
        return r;
    }
    async getRelationships(avatarId) {
        await this.init();
        const rels = await readJson(JSON_FILES.relationships, []);
        return rels.filter((r) => r.avatarId === avatarId);
    }
}
class FirestoreStore {
    constructor() {
        // Lazy import to avoid bundling if not used
        const { Firestore } = require("@google-cloud/firestore");
        const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || defaultServiceKeyPath;
        const hasKeyFile = (() => { try {
            require("fs").accessSync(keyPath);
            return true;
        }
        catch {
            return false;
        } })();
        const options = { projectId: process.env.FIREBASE_PROJECT_ID };
        if (hasKeyFile)
            options.keyFilename = keyPath;
        this.firestore = new Firestore(options);
        this.avatarsCol = this.firestore.collection("avatars");
        this.statesCol = this.firestore.collection("states");
        this.memoriesCol = this.firestore.collection("memories");
        this.personsCol = this.firestore.collection("persons");
        this.relationshipsCol = this.firestore.collection("relationships");
    }
    async getAllAvatarProfiles() {
        const snap = await this.avatarsCol.get();
        return snap.docs.map((d) => d.data());
    }
    async getOrCreateAvatar(avatarId) {
        const now = new Date().toISOString();
        const profileRef = this.avatarsCol.doc(avatarId);
        const stateRef = this.statesCol.doc(avatarId);
        const [pDoc, sDoc] = await Promise.all([profileRef.get(), stateRef.get()]);
        let profile = pDoc.exists ? pDoc.data() : undefined;
        let state = sDoc.exists ? sDoc.data() : undefined;
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
            }
            else if (idLower === "lucia" || idLower === "lucía") {
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
            else {
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
    async saveAvatarProfile(profile) {
        await this.avatarsCol.doc(profile.id).set(profile);
    }
    async saveAvatarState(state) {
        await this.statesCol.doc(state.avatarId).set(state);
    }
    async addMemory(mem) {
        await this.memoriesCol.doc(mem.id).set(mem);
    }
    async getRecentMemories(avatarId, limit) {
        const snap = await this.memoriesCol
            .where("avatarId", "==", avatarId)
            .orderBy("createdAt", "desc")
            .limit(limit)
            .get();
        return snap.docs.map((d) => d.data());
    }
    async getTopKMemoriesByEmbedding(avatarId, query, k) {
        // Firestore cannot do vector search natively; fetch last N and rank locally
        const snap = await this.memoriesCol
            .where("avatarId", "==", avatarId)
            .orderBy("createdAt", "desc")
            .limit(200)
            .get();
        const candidates = snap.docs.map((d) => d.data());
        const queryEmbedding = await embed(query);
        if (queryEmbedding.length === 0)
            return candidates.slice(0, k);
        for (const m of candidates) {
            if (!m.embedding)
                m.embedding = await embed(m.text);
        }
        const scored = candidates
            .map((m) => ({ m, score: m.embedding ? cosineSim(queryEmbedding, m.embedding) : 0 }))
            .sort((a, b) => b.score - a.score)
            .slice(0, k)
            .map((s) => s.m);
        return scored;
    }
    async getLastSeeds(avatarId, limit) {
        const snap = await this.memoriesCol
            .where("avatarId", "==", avatarId)
            .where("type", "==", "preference")
            .orderBy("createdAt", "desc")
            .limit(limit)
            .get();
        const all = snap.docs.map((d) => d.data());
        const seeds = all
            .filter((m) => (m.tags || []).includes("seed"))
            .map((m) => m.text);
        return seeds;
    }
    async upsertPersonByName(avatarId, nombre, rol) {
        const norm = nombre.trim();
        const snap = await this.personsCol
            .where("avatarId", "==", avatarId)
            .where("nombre_lower", "==", norm.toLowerCase())
            .limit(1)
            .get();
        const now = new Date().toISOString();
        if (!snap.empty) {
            const doc = snap.docs[0];
            const p = doc.data();
            if (rol && !p.rol)
                p.rol = rol;
            p.actualizadoEn = now;
            await doc.ref.set({ ...p, nombre_lower: p.nombre.toLowerCase() });
            return p;
        }
        const id = uuidv4();
        const p = { id, avatarId, nombre: norm, rol, creadoEn: now, actualizadoEn: now, nombre_lower: norm.toLowerCase() };
        await this.personsCol.doc(id).set(p);
        delete p.nombre_lower;
        return p;
    }
    async getPersonByName(avatarId, nombre) {
        const norm = nombre.trim().toLowerCase();
        const snap = await this.personsCol
            .where("avatarId", "==", avatarId)
            .where("nombre_lower", "==", norm)
            .limit(1)
            .get();
        if (snap.empty)
            return undefined;
        const p = snap.docs[0].data();
        return p;
    }
    async getPeople(avatarId) {
        const snap = await this.personsCol.where("avatarId", "==", avatarId).get();
        return snap.docs.map((d) => d.data());
    }
    async upsertRelationship(avatarId, personId, tipo, deltaCercania = 0, ultimoEvento) {
        const q = await this.relationshipsCol
            .where("avatarId", "==", avatarId)
            .where("personId", "==", personId)
            .where("tipo", "==", tipo)
            .limit(1)
            .get();
        const now = new Date().toISOString();
        if (q.empty) {
            const id = uuidv4();
            const r = { id, avatarId, personId, tipo, cercania: Math.max(0, Math.min(1, 0.5 + deltaCercania)), actualizadoEn: now, ultimoEvento };
            await this.relationshipsCol.doc(id).set(r);
            return r;
        }
        const doc = q.docs[0];
        const r = doc.data();
        r.cercania = Math.max(0, Math.min(1, r.cercania + deltaCercania));
        if (ultimoEvento)
            r.ultimoEvento = ultimoEvento;
        r.actualizadoEn = now;
        await doc.ref.set(r);
        return r;
    }
    async getRelationships(avatarId) {
        const snap = await this.relationshipsCol.where("avatarId", "==", avatarId).get();
        return snap.docs.map((d) => d.data());
    }
}
const store = useFirestore ? new FirestoreStore() : new JsonStore();
export async function getOrCreateAvatar(avatarId) {
    return store.getOrCreateAvatar(avatarId);
}
export async function saveAvatarProfile(profile) {
    return store.saveAvatarProfile(profile);
}
export async function saveAvatarState(state) {
    return store.saveAvatarState(state);
}
export async function addMemory(mem) {
    const withIds = {
        id: mem.id || uuidv4(),
        createdAt: mem.createdAt || new Date().toISOString(),
        ...mem,
    };
    return store.addMemory(withIds);
}
export async function getRecentMemories(avatarId, limit) {
    return store.getRecentMemories(avatarId, limit);
}
export async function getTopKMemoriesByEmbedding(avatarId, query, k) {
    return store.getTopKMemoriesByEmbedding(avatarId, query, k);
}
export async function getLastSeeds(avatarId, limit) {
    return store.getLastSeeds(avatarId, limit);
}
export async function getAllAvatarProfiles() {
    return store.getAllAvatarProfiles();
}
// Personas y relaciones
export async function upsertPersonByName(avatarId, nombre, rol) {
    return store.upsertPersonByName(avatarId, nombre, rol);
}
export async function getPersonByName(avatarId, nombre) {
    return store.getPersonByName(avatarId, nombre);
}
export async function getPeople(avatarId) {
    return store.getPeople(avatarId);
}
export async function upsertRelationship(avatarId, personId, tipo, deltaCercania, ultimoEvento) {
    return store.upsertRelationship(avatarId, personId, tipo, deltaCercania, ultimoEvento);
}
export async function getRelationships(avatarId) {
    return store.getRelationships(avatarId);
}
