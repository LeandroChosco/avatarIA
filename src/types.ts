export type Mood = "feliz" | "neutral" | "triste" | "ansiosa" | "entusiasmada" | "nostálgica";

export interface AvatarProfile {
  id: string;
  nombre: string;
  ocupacion: string; // ej: "diseñadora de moda"
  edadVirtual: number;
  caracter: string; // ej: "creativa, sarcástica, empática"
  valores: string[];
  formaDeHablar: string; // estilo de lenguaje
  hobbies: string[];
  relaciones: Record<string, string>;
  creadoEn: string; // ISO date
}

export interface AvatarState {
  avatarId: string;
  mood: Mood;
  energia: number; // 0–1
  afectoUsuario: number; // 0–1
  contextoActual?: string; // ej: "trabajando en una colección"
  actualizadoEn: string; // ISO date
}

export type MemoryType = "episodic" | "semantic" | "diary" | "preference";

export interface Memory {
  id: string;
  avatarId: string;
  type: MemoryType;
  text: string;
  emotion?: Mood;
  salience: number; // 0–1
  tags?: string[];
  embedding?: number[];
  createdAt: string; // ISO date
  entityRefs?: string[]; // ids de personas u otras entidades mencionadas
}

export interface ActivitySeed {
  tipo: "profesional" | "social" | "hobby" | "emocional";
  semilla: string; // breve intención
}

export interface ActivityEvent {
  evento: string; // 1–3 líneas
  reflexion?: string;
}

export interface Person {
  id: string;
  avatarId: string;
  nombre: string;
  rol?: string; // p. ej., "compañero de trabajo", "amigo"
  notas?: string;
  creadoEn: string;
  actualizadoEn: string;
}

export type RelationshipType = "amistad" | "trabajo" | "amor" | "familia";
export interface Relationship {
  id: string;
  avatarId: string;
  personId: string;
  tipo: RelationshipType;
  cercania: number; // 0–1
  ultimoEvento?: string;
  actualizadoEn: string;
}

export interface ChatRequestBody {
  avatarId: string;
  userMessage: string;
}

export interface TopKOptions {
  k: number;
}


