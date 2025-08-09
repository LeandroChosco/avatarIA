import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const NOTIF_FILE = path.join(projectRoot, "notifications.json");

type Notification = {
  avatarId: string;
  messages: string[];
  createdAt: string;
};

async function ensureFile() {
  try {
    await fs.access(NOTIF_FILE);
  } catch {
    await fs.writeFile(NOTIF_FILE, "[]\n", "utf8");
  }
}

async function readAll(): Promise<Notification[]> {
  await ensureFile();
  const c = await fs.readFile(NOTIF_FILE, "utf8");
  return c.trim() ? (JSON.parse(c) as Notification[]) : [];
}

async function writeAll(items: Notification[]) {
  await fs.writeFile(NOTIF_FILE, JSON.stringify(items, null, 2), "utf8");
}

export async function addNotification(avatarId: string, messages: string[]) {
  if (!messages.length) return;
  const all = await readAll();
  all.push({ avatarId, messages, createdAt: new Date().toISOString() });
  await writeAll(all);
}

export async function getAndClearNotifications(avatarId: string): Promise<string[]> {
  const all = await readAll();
  const keep: Notification[] = [];
  const out: string[] = [];
  for (const n of all) {
    if (n.avatarId === avatarId) out.push(...n.messages);
    else keep.push(n);
  }
  await writeAll(keep);
  return out;
}


