export function buildActivitySeedPrompt(profile, state, lastSeeds) {
    const avoid = lastSeeds.length ? `Evita repetir estas últimas semillas: ${lastSeeds.join("; ")}.` : "";
    return [
        "Genera una semilla de actividad en JSON estricto para el día de hoy.",
        "Elige tipo entre: 'profesional' | 'social' | 'hobby' | 'emocional'.",
        "Debes personalizar la intención a la ocupación, mood, energía, hobbies y relaciones.",
        avoid,
        "Formato de salida (sin texto adicional): {\"tipo\": \"...\", \"semilla\": \"...\"}",
        "",
        `Perfil: ${profile.nombre}, ocupación ${profile.ocupacion}, hobbies ${profile.hobbies.join(", ")}.`,
        `Estado: mood=${state.mood}, energia=${state.energia.toFixed(2)}, afectoUsuario=${state.afectoUsuario.toFixed(2)}.`,
    ].join("\n");
}
export function parseActivitySeed(text) {
    try {
        const obj = JSON.parse(text.trim());
        if (obj && typeof obj.semilla === "string" && typeof obj.tipo === "string") {
            return { tipo: obj.tipo, semilla: obj.semilla };
        }
    }
    catch {
        // ignore
    }
    return null;
}
