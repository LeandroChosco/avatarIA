import dotenv from "dotenv";
dotenv.config();
import { tickAllAvatars } from "./avatarEngine.js";
async function main() {
    const count = await tickAllAvatars();
    console.log(`Avatares procesados: ${count}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
