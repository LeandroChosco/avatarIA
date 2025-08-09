import { getOrCreateAvatar } from "../src/memoryStore.js";
import { ensureDefaultRelations, addCoreRelationMemories } from "../src/relations.js";

function setCors(res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function readBody(req: any): Promise<any> {
  if (req.body) return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  let raw = "";
  await new Promise<void>((resolve) => {
    if (typeof req.setEncoding === "function") req.setEncoding("utf8");
    if (typeof req.on === "function") {
      req.on("data", (chunk: string) => { raw += chunk; });
      req.on("end", () => resolve());
    } else {
      resolve();
    }
  });
  try { return JSON.parse(raw || "{}"); } catch { return {}; }
}

export default async function handler(req: any, res: any) {
  setCors(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method Not Allowed" }); return; }
  try {
    const body = await readBody(req);
    const avatarId = String((body?.avatarId || "demo").trim());
    const { profile, state } = await getOrCreateAvatar(avatarId);
    await ensureDefaultRelations(avatarId);
    await addCoreRelationMemories(avatarId);
    res.status(200).json({ profile, state });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: "Error creando avatar" });
  }
}


