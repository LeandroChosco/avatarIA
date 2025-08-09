import OpenAI from "openai";
import { OPENAI_API_KEY_FALLBACK } from "./localSecrets.js";
import { getOrCreateAvatar, addMemory, getTopKMemoriesByEmbedding, getRecentMemories, saveAvatarState, getPeople, getRelationships, } from "./memoryStore.js";
import { ensureDefaultRelations } from "./relations.js";
import { buildChatPrompt } from "./prompts/chat.js";
import { buildPersonaSystemPrompt } from "./prompts/persona.js";
import { buildToneGuidance } from "./tone.js";
import { analyzeAndUpdateUserStyle, getUserStyleGuidance } from "./styleStore.js";
const modelChat = process.env.MODEL_CHAT || "gpt-4o-mini";
const modelCheap = process.env.MODEL_CHEAP || modelChat;
function detectEmotion(text) {
    const t = text.toLowerCase();
    if (/feliz|content[oa]|alegr[ía]/.test(t))
        return "feliz";
    if (/trist[ea]|melanc|llor|deprim/.test(t))
        return "triste";
    if (/ansios|estres|nervios/.test(t))
        return "ansiosa";
    if (/emocionad|entusiasm/.test(t))
        return "entusiasmada";
    if (/nostal[gí]a|record/.test(t))
        return "nostálgica";
    return "neutral";
}
function estimateSalience(text) {
    const len = Math.min(text.length, 200);
    const exclam = (text.match(/!/g) || []).length;
    return Math.min(1, 0.2 + len / 400 + Math.min(0.3, exclam * 0.05));
}
export function extractNewMemories(userMsg, avatarReply, avatarId) {
    const combined = `${userMsg}\n${avatarReply}`;
    const emotion = detectEmotion(combined);
    const salience = estimateSalience(combined);
    const episodic = {
        id: "", // will be filled by store
        avatarId,
        type: "episodic",
        text: `Conversación: usuario dijo "${userMsg}"; avatar respondió "${avatarReply}"`.
            slice(0, 400),
        emotion,
        salience,
        tags: ["chat"],
        createdAt: "",
    };
    const extra = [episodic];
    // Heurística simple: detectar preferencias o hechos del usuario para memoria "semantic"
    const lower = userMsg.toLowerCase();
    const factPatterns = [
        /me llamo\s+([a-záéíóúñ\-\s]{2,})/i,
        /me gusta[n]?\s+([a-z0-9áéíóúñ\-\s]{2,})/i,
        /soy\s+([a-z0-9áéíóúñ\-\s]{2,})/i,
        /mi\s+([a-záéíóúñ]{2,})\s+es\s+([a-z0-9áéíóúñ\-\s]{2,})/i,
    ];
    for (const rx of factPatterns) {
        const m = userMsg.match(rx);
        if (m) {
            const text = `Dato del usuario: ${m[0]}`.slice(0, 200);
            extra.push({
                id: "",
                avatarId,
                type: "semantic",
                text,
                salience: Math.max(0.6, salience),
                tags: ["user-fact"],
                createdAt: "",
            });
            break;
        }
    }
    return extra;
}
// Detección de personas deshabilitada: relaciones se definen por semilla fija
export async function handleChat(avatarId, userMessage) {
    const { profile, state } = await getOrCreateAvatar(avatarId);
    // Asegura relaciones por defecto (Fernando, Sofía, Enrique)
    await ensureDefaultRelations(avatarId);
    const topK = await getTopKMemoriesByEmbedding(avatarId, userMessage, 5).catch(async () => {
        return getRecentMemories(avatarId, 5);
    });
    // Asegurar incluir el último diario
    const recent = await getRecentMemories(avatarId, 5);
    const lastDiary = recent.find((m) => m.type === "diary");
    const memorySet = lastDiary
        ? [lastDiary, ...topK.filter((m) => m.id !== lastDiary.id)]
        : topK;
    // Analiza modismos del usuario y construye guía de estilo
    await analyzeAndUpdateUserStyle(avatarId, userMessage);
    const userStyle = await getUserStyleGuidance(avatarId);
    const prompt = buildChatPrompt(profile, state, memorySet);
    // Contexto relacional fijo (personas/roles) para que el avatar "sepa" quiénes son
    let relationContext = "";
    let peopleCache = [];
    try {
        const [people, relationships] = await Promise.all([getPeople(avatarId), getRelationships(avatarId)]);
        peopleCache = people;
        if (people.length) {
            const stop = new Set(["de", "el", "la", "los", "las", "vos", "quien", "cualquier", "tanto"]);
            const valid = people.filter((p) => {
                const n = (p.nombre || "").trim();
                if (!n)
                    return false;
                const base = n.normalize("NFD").replace(/\p{Diacritic}/gu, "");
                return !stop.has(base.toLowerCase()) && (/[A-ZÁÉÍÓÚÑ]/.test(n[0]) || ["sofia", "enrique", "fernando"].includes(base.toLowerCase()));
            });
            // Priorizar personas clave y luego por cercanía de relación
            const relByPerson = Object.create(null);
            for (const r of relationships)
                relByPerson[r.personId] = Math.max(relByPerson[r.personId] || 0, r.cercania || 0);
            const keyOrder = (name) => ({ sofia: 0, enrique: 1, fernando: 2 }[name.toLowerCase()] ?? 9);
            valid.sort((a, b) => {
                const ka = keyOrder(a.nombre.normalize("NFD").replace(/\p{Diacritic}/gu, ""));
                const kb = keyOrder(b.nombre.normalize("NFD").replace(/\p{Diacritic}/gu, ""));
                if (ka !== kb)
                    return ka - kb;
                return (relByPerson[b.id] || 0) - (relByPerson[a.id] || 0);
            });
            const roleLabel = (name, rol) => (rol ? `${name} (${rol})` : name);
            const top = valid.slice(0, 5).map((p) => roleLabel(p.nombre, p.rol)).join(", ");
            relationContext = top ? `Personas cercanas del avatar: ${top}` : "";
            // Últimos eventos por relación si existen
            const relNotes = relationships
                .filter((r) => r.ultimoEvento)
                .slice(0, 3)
                .map((r) => r.ultimoEvento)
                .join(" | ");
            if (relNotes)
                relationContext += `\nNotas recientes: ${relNotes}`;
            // Hechos relacionales explícitos (si están presentes)
            const byName = (name) => valid.find((p) => p.nombre.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase() === name);
            const f = byName("fernando");
            const s = byName("sofia");
            const e = byName("enrique");
            const facts = [];
            if (f)
                facts.push("Fernando es su compañero de trabajo");
            if (s)
                facts.push("Sofía es su jefa");
            if (e)
                facts.push("Enrique es su hermano");
            if (facts.length)
                relationContext += `\nHechos relacionales: ${facts.join("; ")}`;
        }
        if (!relationContext) {
            // Fallback por si aún no se guardó nada en almacenamiento
            relationContext = "Personas cercanas del avatar: Fernando (compañero de trabajo), Sofía (jefa), Enrique (hermano)\nHechos relacionales: Fernando es su compañero de trabajo; Sofía es su jefa; Enrique es su hermano";
        }
    }
    catch (e) {
        // ignore
    }
    let reply = "";
    const apiKey = process.env.OPENAI_API_KEY || OPENAI_API_KEY_FALLBACK;
    if (apiKey) {
        const client = new OpenAI({ apiKey });
        const res = await client.chat.completions.create({
            model: modelChat,
            messages: [
                { role: "system", content: prompt.system },
                { role: "system", content: prompt.context },
                ...(relationContext ? [{ role: "system", content: relationContext }] : []),
                ...(userStyle ? [{ role: "system", content: userStyle }] : []),
                { role: "user", content: userMessage },
            ],
            temperature: 0.8,
        });
        const raw = res.choices[0]?.message?.content?.trim() || "";
        // Permitir múltiples mensajes con ' || '
        reply = raw;
    }
    else {
        // Heurística si no hay API: eco amistoso
        reply = `Hablemos 😊: ${userMessage}`;
    }
    // Construye memorias y persiste (sin crear relaciones automáticamente)
    const memories = extractNewMemories(userMessage, reply, avatarId);
    for (const m of memories)
        await addMemory(m);
    // Espontaneidad: con probabilidad agrega 1 pregunta específica SOLO si hay contexto
    if (Math.random() < 0.35) {
        const t = userMessage.toLowerCase();
        const isGenericAsk = /(como\s+estas|como\s+has\s+estado|que\s+tal\s+vas|como\s+te\s+sientes)/i.test(t);
        const followups = [];
        // Personas conocidas del avatar
        if (peopleCache.length) {
            for (const p of peopleCache) {
                const name = p.nombre.toLowerCase();
                if (name && t.includes(name)) {
                    const variants = [
                        (n) => `y ${n} que dijo?`,
                        (n) => `y con ${n} al final q paso?`,
                        (n) => `q onda con ${n} entonces`,
                    ];
                    const v = variants[Math.floor(Math.random() * variants.length)];
                    followups.push(v(p.nombre));
                    break;
                }
            }
        }
        // Temas detectables
        if (/cine|pel[ií]cula|superman|funci[oó]n/.test(t))
            followups.push("como estuvo la peli?");
        if (/trabajo|proyecto|colecci[oó]n|dise[nñ]o|ventas?/.test(t))
            followups.push("y eso en el trabajo como resulto?");
        if (/familia|hermano|hermana|mam[aá]|pap[aá]/.test(t))
            followups.push("y en casa todo bien?");
        if (/caf[eé]|cafe/.test(t))
            followups.push("te peg[oó] el cafecito?");
        if (/clase|alumno|idioma/.test(t))
            followups.push("te fue bien con la clase?");
        // Solo agrega si hay al menos 1 follow-up contextual y no es una pregunta genérica al avatar
        if (followups.length && !isGenericAsk) {
            reply = `${reply} || ${followups[Math.floor(Math.random() * followups.length)]}`;
        }
    }
    // Lightly update affection and context
    const newState = {
        ...state,
        afectoUsuario: Math.min(1, state.afectoUsuario + 0.02),
        contextoActual: `charlando sobre: ${userMessage.slice(0, 40)}`,
        actualizadoEn: new Date().toISOString(),
    };
    await saveAvatarState(newState);
    return reply || "(sin respuesta)";
}
export async function generateOpening(avatarId) {
    const { profile, state } = await getOrCreateAvatar(avatarId);
    await ensureDefaultRelations(avatarId);
    const recents = await getRecentMemories(avatarId, 8);
    const diary = recents.find((m) => m.type === "diary");
    const hints = recents
        .filter((m) => m.type !== "preference")
        .map((m) => m.text)
        .join(" | ");
    const apiKey = process.env.OPENAI_API_KEY || OPENAI_API_KEY_FALLBACK;
    const style = await getUserStyleGuidance(avatarId);
    if (apiKey) {
        const client = new OpenAI({ apiKey });
        const sys = buildPersonaSystemPrompt(profile);
        const tone = buildToneGuidance(state);
        const context = [
            diary ? `Último diario: ${diary.text}` : "",
            hints ? `Pistas recientes: ${hints}` : "",
            "Escribe 1–2 mensajes muy cortos (usa ' || ' si son 2). Muy informal, sin signos de apertura, sin punto final. Conecta con lo último que hiciste o de lo que hablaron (si aplica).",
        ]
            .filter(Boolean)
            .join("\n");
        const res = await client.chat.completions.create({
            model: modelChat,
            messages: [
                { role: "system", content: sys },
                { role: "system", content: tone },
                ...(style ? [{ role: "system", content: style }] : []),
                { role: "system", content: context },
                { role: "user", content: "Inicia conversación con algo natural y cercano" },
            ],
            temperature: 0.9,
        });
        return res.choices[0]?.message?.content?.trim() || "hey, cómo va";
    }
    // Fallback heurístico
    const texts = recents.map((m) => m.text.toLowerCase());
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    if (texts.some((t) => /pel[ií]cul|cine|superman/.test(t)))
        return pick(["y q tal estuvo la película?", "como te fue en el cine? jajaja"]);
    if (diary)
        return pick(["hoy anduve movida con eso q te conté", "te conté lo de hoy? estuvo raro jajaja"]);
    return pick(["hey q onda", "holi", "que cuentas?"]);
}
