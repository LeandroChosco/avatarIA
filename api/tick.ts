import { tickAllAvatars } from "../src/avatarEngine.js";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }
  try {
    const processed = await tickAllAvatars();
    res.status(200).json({ processed });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: "Error en tick" });
  }
}


