import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { handleChat, generateOpening } from "./chatHandler.js";
import { getOrCreateAvatar } from "./memoryStore.js";
import { ensureDefaultRelations, addCoreRelationMemories } from "./relations.js";
import { tickAllAvatars } from "./avatarEngine.js";
import { getAndClearNotifications } from "./notifyStore.js";
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "..", "public");
app.use(express.static(publicDir));
// Simple rate limit per IP+avatar
const rateMap = new Map();
function rateKey(ip, avatarId) { return `${ip}|${avatarId}`; }
app.post("/api/chat", async (req, res) => {
    try {
        const body = req.body;
        const avatarId = String((body.avatarId || "").trim() || "demo");
        const userMessage = String((body.userMessage || "").trim());
        if (!userMessage)
            return res.status(400).json({ error: "userMessage requerido" });
        const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
        const key = rateKey(ip, avatarId);
        const now = Date.now();
        const last = rateMap.get(key) || 0;
        if (now - last < 1500)
            return res.status(429).json({ error: "Rate limit" });
        rateMap.set(key, now);
        // Mensajes espontáneos pendientes (p. ej., tras un tick)
        const spontaneous = await getAndClearNotifications(avatarId);
        const reply = await handleChat(avatarId, userMessage);
        const combined = spontaneous.length ? `${reply} || ${spontaneous.join(" || ")}` : reply;
        res.json({ reply: combined });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error en chat" });
    }
});
app.post("/api/seed", async (req, res) => {
    try {
        const avatarId = String((req.body?.avatarId || "demo").trim());
        const { profile, state } = await getOrCreateAvatar(avatarId);
        await ensureDefaultRelations(avatarId);
        await addCoreRelationMemories(avatarId);
        res.json({ profile, state });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error creando avatar" });
    }
});
app.post("/api/tick", async (req, res) => {
    try {
        const processed = await tickAllAvatars();
        res.json({ processed });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error en tick" });
    }
});
app.post("/api/opening", async (req, res) => {
    try {
        const avatarId = String((req.body?.avatarId || "demo").trim());
        const opening = await generateOpening(avatarId);
        res.json({ opening });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error generando apertura" });
    }
});
const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
    console.log(`Avatar MVP escuchando en http://localhost:${PORT}`);
});
