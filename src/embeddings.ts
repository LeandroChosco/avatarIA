import OpenAI from "openai";
import { OPENAI_API_KEY_FALLBACK } from "./localSecrets.js";

function getOpenAIKey(): string | undefined {
  return process.env.OPENAI_API_KEY || OPENAI_API_KEY_FALLBACK;
}
const embeddingsModel = process.env.EMBEDDINGS_MODEL || "text-embedding-3-small";

export async function embed(text: string): Promise<number[]> {
  const openaiApiKey = getOpenAIKey();
  if (!openaiApiKey) {
    return [];
  }
  const client = new OpenAI({ apiKey: openaiApiKey });
  const res = await client.embeddings.create({ model: embeddingsModel, input: text });
  return res.data[0]?.embedding ?? [];
}

export function cosineSim(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}


