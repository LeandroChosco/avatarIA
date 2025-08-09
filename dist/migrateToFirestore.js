import dotenv from "dotenv";
dotenv.config();
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { v4 as uuidv4 } from "uuid";
import { Firestore } from "@google-cloud/firestore";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(projectRoot, "services-firebase.json");
const hasKey = await fs.access(keyPath).then(() => true).catch(() => false);
const options = { projectId: process.env.FIREBASE_PROJECT_ID };
const inlineCred = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (inlineCred) {
    try {
        const json = JSON.parse(inlineCred);
        options.credentials = { client_email: json.client_email, private_key: json.private_key };
    }
    catch { }
}
if (!options.credentials && hasKey)
    options.keyFilename = keyPath;
const firestore = new Firestore(options);
const files = {
    avatars: path.join(projectRoot, "avatars.json"),
    states: path.join(projectRoot, "states.json"),
    memories: path.join(projectRoot, "memories.json"),
    persons: path.join(projectRoot, "persons.json"),
    relationships: path.join(projectRoot, "relationships.json"),
};
async function readJsonOr(filePath, fallback) {
    try {
        const c = await fs.readFile(filePath, "utf8");
        return c.trim() ? JSON.parse(c) : fallback;
    }
    catch {
        return fallback;
    }
}
async function migrateCollection(colName, items, getDocId) {
    const col = firestore.collection(colName);
    let written = 0;
    for (const item of items) {
        const id = getDocId(item) || uuidv4();
        // Ensure createdAt/id in memories
        if (colName === "memories") {
            if (!item.createdAt)
                item.createdAt = new Date().toISOString();
            if (!item.id)
                item.id = id;
        }
        await col.doc(id).set(item, { merge: true });
        written++;
    }
    console.log(`Migrated ${written} docs → ${colName}`);
}
async function main() {
    if (!process.env.FIREBASE_PROJECT_ID) {
        console.error("FIREBASE_PROJECT_ID no está definido. Configúralo en .env");
        process.exit(1);
    }
    const avatars = await readJsonOr(files.avatars, []);
    const states = await readJsonOr(files.states, []);
    const memories = await readJsonOr(files.memories, []);
    const persons = await readJsonOr(files.persons, []);
    const relationships = await readJsonOr(files.relationships, []);
    await migrateCollection("avatars", avatars, (x) => x.id || x.avatarId);
    await migrateCollection("states", states, (x) => x.avatarId);
    await migrateCollection("memories", memories, (x) => x.id);
    await migrateCollection("persons", persons, (x) => x.id);
    await migrateCollection("relationships", relationships, (x) => x.id);
    console.log("Migración completa a Firestore.");
}
main().catch((e) => { console.error(e); process.exit(1); });
