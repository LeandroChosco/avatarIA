## Avatar con vida (MVP)

Web app con chat y backend Node/Express. Memoria en Firestore si hay credenciales, o JSON local como fallback.

### Requisitos
- Node 18+
- (Opcional) Firestore: `GOOGLE_APPLICATION_CREDENTIALS` y `FIREBASE_PROJECT_ID`.

### Configuración
1. Crea un archivo `.env` en la raíz con:
   - `OPENAI_API_KEY=...`
   - `MODEL_CHAT=gpt-4o-mini`
   - `MODEL_CHEAP=gpt-4o-mini`
   - `EMBEDDINGS_MODEL=text-embedding-3-small`
   - `PORT=3000`
   - (Opcional) `FIREBASE_PROJECT_ID=...` y `GOOGLE_APPLICATION_CREDENTIALS=...`

2. Instala dependencias:
   ```bash
   npm install
   ```

3. Desarrollo:
   ```bash
   npm run dev
   ```
   Abre `http://localhost:3000`.

4. Producción:
   ```bash
   npm run build
   npm start
   ```

5. Semilla rápida (avatar demo):
   ```bash
   npm run seed
   ```

6. Tick local (motor de vida):
   ```bash
   npm run tick
   ```

### Endpoints
- `POST /api/chat` body `{ avatarId, userMessage }` → `{ reply }`
- `POST /api/seed` body `{ avatarId? }` → crea/obtiene perfil y estado
- `POST /api/tick` → ejecuta motor de vida y guarda diario

### Persistencia
- Si hay credenciales de Firestore, usa colecciones: `avatars`, `states`, `memories`.
- Si no, se crean archivos `avatars.json`, `states.json`, `memories.json` en la raíz del proyecto.

### Cloud Scheduler
Ver `scripts/scheduler.md` para crear un job HTTP cada 6 horas.


