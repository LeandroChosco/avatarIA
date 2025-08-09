import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type StyleStats = {
  avatarId: string;
  totalMessages: number;
  emojiHits: number;
  laughHits: number; // jajaja/jeje/xd
  abbrevHits: Record<string, number>; // q,xq,pq,kiero,naa,bn,tmb,etc.
  questionMarks: number;
  exclamMarks: number;
  openingMarks: number; // ¿ ¡
  endingDots: number; // messages ending with .
  lowercaseDominant: number; // messages mostly lowercase
  lastUpdated: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const STYLES_FILE = path.join(projectRoot, "styles.json");

async function ensureFile() {
  try { await fs.access(STYLES_FILE); }
  catch { await fs.writeFile(STYLES_FILE, "[]\n", "utf8"); }
}

async function readAll(): Promise<StyleStats[]> {
  await ensureFile();
  const c = await fs.readFile(STYLES_FILE, "utf8");
  return c.trim() ? (JSON.parse(c) as StyleStats[]) : [];
}

async function writeAll(items: StyleStats[]) {
  await fs.writeFile(STYLES_FILE, JSON.stringify(items, null, 2), "utf8");
}

function countEmojis(text: string): number {
  // Rough emoji regex
  const m = text.match(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu);
  return m ? m.length : 0;
}

const LAUGHS = [/jaj+a+/gi, /jeje+/gi, /jiji+/gi, /xd+/gi];
const ABBREV = ["q", "xq", "pq", "kiero", "naa", "bn", "tmb", "k", "pa", "pq", "neta", "chido"];

export async function analyzeAndUpdateUserStyle(avatarId: string, userMessage: string) {
  const all = await readAll();
  let s = all.find((x) => x.avatarId === avatarId);
  if (!s) {
    s = {
      avatarId,
      totalMessages: 0,
      emojiHits: 0,
      laughHits: 0,
      abbrevHits: {},
      questionMarks: 0,
      exclamMarks: 0,
      openingMarks: 0,
      endingDots: 0,
      lowercaseDominant: 0,
      lastUpdated: new Date().toISOString(),
    };
    all.push(s);
  }
  const t = userMessage.trim();
  s.totalMessages += 1;
  s.emojiHits += countEmojis(t);
  s.laughHits += LAUGHS.reduce((acc, rx) => acc + ((t.match(rx) || []).length), 0);
  const lower = t.toLowerCase();
  for (const ab of ABBREV) {
    const rx = new RegExp(`(?:^|\n|\s)${ab}(?:\s|[!?.,]|$)`, "gi");
    const hits = (t.match(rx) || []).length;
    if (hits) s.abbrevHits[ab] = (s.abbrevHits[ab] || 0) + hits;
  }
  s.questionMarks += (t.match(/\?/g) || []).length;
  s.exclamMarks += (t.match(/!/g) || []).length;
  s.openingMarks += (t.match(/[¿¡]/g) || []).length;
  if (/\.$/.test(t)) s.endingDots += 1;
  const alpha = (t.match(/[A-Za-zÁÉÍÓÚÑáéíóúñ]/g) || []).length;
  const lowerAlpha = (t.match(/[a-záéíóúñ]/g) || []).length;
  if (alpha > 0 && lowerAlpha / alpha > 0.7) s.lowercaseDominant += 1;
  s.lastUpdated = new Date().toISOString();
  await writeAll(all);
}

export async function getUserStyleGuidance(avatarId: string): Promise<string> {
  const all = await readAll();
  const s = all.find((x) => x.avatarId === avatarId);
  if (!s || s.totalMessages < 3) return ""; // need some samples
  const emojiRate = s.emojiHits / s.totalMessages;
  const laughRate = s.laughHits / s.totalMessages;
  const qRate = s.questionMarks / Math.max(1, s.totalMessages);
  const exRate = s.exclamMarks / Math.max(1, s.totalMessages);
  const openRate = s.openingMarks / Math.max(1, s.totalMessages);
  const dotRate = s.endingDots / Math.max(1, s.totalMessages);
  const lowerDomRate = s.lowercaseDominant / Math.max(1, s.totalMessages);
  const topAbbrev = Object.entries(s.abbrevHits)
    .sort((a, b) => (b[1] || 0) - (a[1] || 0))
    .slice(0, 4)
    .map(([k]) => k);

  const prefs: string[] = [];
  if (emojiRate > 0.2) prefs.push("usa emojis a menudo");
  if (laughRate > 0.3) prefs.push("incluye 'jajaja' seguido de nada (sin punto)");
  if (openRate < 0.2) prefs.push("evita signos de apertura");
  if (dotRate < 0.3) prefs.push("no termines con punto final");
  if (lowerDomRate > 0.5) prefs.push("usa minúsculas la mayor parte del tiempo");
  if (exRate > 0.5) prefs.push("usa '!' con frecuencia");
  if (qRate > 0.5) prefs.push("haz preguntas a menudo");
  if (topAbbrev.length) prefs.push(`usa abreviaturas como: ${topAbbrev.join(", ")}`);

  if (!prefs.length) return "";
  return `Imita modismos del usuario: ${prefs.join("; ")}.`;
}


