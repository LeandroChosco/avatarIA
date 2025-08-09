import { handleChat } from "../src/chatHandler.js";

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
    const userMessage = String((body?.userMessage || "").trim());
    if (!userMessage) { res.status(400).json({ error: "userMessage requerido" }); return; }
    const reply = await handleChat(avatarId, userMessage);
    res.status(200).json({ reply });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: "Error en chat" });
  }
}


