import { upsertPersonByName, upsertRelationship, addMemory } from "./memoryStore.js";
export async function ensureDefaultRelations(avatarId) {
    const id = avatarId.toLowerCase();
    if (id === "julio") {
        const susana = await upsertPersonByName(avatarId, "Susana", "jefa");
        const roberto = await upsertPersonByName(avatarId, "Roberto", "compañero");
        await upsertRelationship(avatarId, susana.id, "trabajo", 0.1, "Relación inicial: jefa");
        await upsertRelationship(avatarId, roberto.id, "trabajo", 0.08, "Relación inicial: compañero");
        return;
    }
    if (id === "lucia" || id === "lucía") {
        const rosa = await upsertPersonByName(avatarId, "Rosa", "hermana");
        const matias = await upsertPersonByName(avatarId, "Matias", "compañero de trabajo");
        await upsertRelationship(avatarId, rosa.id, "familia", 0.2, "Relación inicial: hermana");
        await upsertRelationship(avatarId, matias.id, "trabajo", 0.08, "Relación inicial: compañero de trabajo");
        return;
    }
    // default (Lia/diseñadora)
    const fernando = await upsertPersonByName(avatarId, "Fernando", "compañero de trabajo");
    const sofia = await upsertPersonByName(avatarId, "Sofía", "jefa");
    const enrique = await upsertPersonByName(avatarId, "Enrique", "hermano");
    await upsertRelationship(avatarId, fernando.id, "trabajo", 0.1, "Relación inicial: compañero de trabajo");
    await upsertRelationship(avatarId, sofia.id, "trabajo", 0.08, "Relación inicial: jefa");
    await upsertRelationship(avatarId, enrique.id, "familia", 0.2, "Relación inicial: hermano");
}
export async function addCoreRelationMemories(avatarId) {
    const id = avatarId.toLowerCase();
    if (id === "julio") {
        const susana = await upsertPersonByName(avatarId, "Susana", "jefa");
        const roberto = await upsertPersonByName(avatarId, "Roberto", "compañero");
        await addMemory({ avatarId, type: "semantic", text: "Susana es mi jefa", salience: 0.8, tags: ["relation:core", "person:susana"], entityRefs: [susana.id] });
        await addMemory({ avatarId, type: "semantic", text: "Roberto es mi compañero", salience: 0.8, tags: ["relation:core", "person:roberto"], entityRefs: [roberto.id] });
        return;
    }
    if (id === "lucia" || id === "lucía") {
        const rosa = await upsertPersonByName(avatarId, "Rosa", "hermana");
        const matias = await upsertPersonByName(avatarId, "Matias", "compañero de trabajo");
        await addMemory({ avatarId, type: "semantic", text: "Rosa es mi hermana", salience: 0.85, tags: ["relation:core", "person:rosa"], entityRefs: [rosa.id] });
        await addMemory({ avatarId, type: "semantic", text: "Matias es mi compañero de trabajo", salience: 0.8, tags: ["relation:core", "person:matias"], entityRefs: [matias.id] });
        return;
    }
    const fernando = await upsertPersonByName(avatarId, "Fernando", "compañero de trabajo");
    const sofia = await upsertPersonByName(avatarId, "Sofía", "jefa");
    const enrique = await upsertPersonByName(avatarId, "Enrique", "hermano");
    await addMemory({ avatarId, type: "semantic", text: "Fernando es mi compañero de trabajo", salience: 0.8, tags: ["relation:core", "person:fernando"], entityRefs: [fernando.id] });
    await addMemory({ avatarId, type: "semantic", text: "Sofía es mi jefa", salience: 0.8, tags: ["relation:core", "person:sofia"], entityRefs: [sofia.id] });
    await addMemory({ avatarId, type: "semantic", text: "Enrique es mi hermano", salience: 0.85, tags: ["relation:core", "person:enrique"], entityRefs: [enrique.id] });
}
