import { isObject } from "@util";

/**
 * Pull actor and token art from module.json files, which will replace default images on compendium actors and their
 * prototype tokens
 */
async function registerModuleArt(): Promise<void> {
    const activeModules = [...game.modules.entries()].filter(([_key, m]) => m.active);
    for (const [moduleKey, foundryModule] of activeModules) {
        const moduleArt = await getArtMap(foundryModule.flags?.[moduleKey]?.["pf2e-art"]);
        if (!moduleArt) continue;

        for (const [packName, art] of Object.entries(moduleArt)) {
            const pack = game.packs.get(`pf2e.${packName}`);
            if (!pack) {
                console.warn(
                    `PF2e System | Failed pack lookup from module art registration (${moduleKey}): ${packName}`
                );
                continue;
            }

            const index = pack.indexed ? pack.index : await pack.getIndex();
            for (const [actorId, paths] of Object.entries(art)) {
                const record = index.get(actorId);
                if (!record) continue;

                record.img = paths.actor;
                game.pf2e.system.moduleArt.set(`Compendium.pf2e.${packName}.${actorId}`, paths);
            }
        }
    }
}

async function getArtMap(art: unknown): Promise<ModuleArtRecord | null> {
    if (!art) {
        return null;
    } else if (isModuleArt(art)) {
        return art;
    } else if (typeof art === "string") {
        // Instead of being in a module.json file, the art map is in a separate JSON file referenced by path
        try {
            const response = await fetch(art);
            const map = await response.json();
            return isModuleArt(map) ? map : null;
        } catch (error) {
            if (error instanceof Error) {
                ui.notifications.error(error.message);
            }
        }
    }

    return null;
}

function isModuleArt(record: unknown): record is ModuleArtRecord {
    return (
        isObject<Record<string, unknown>>(record) &&
        Object.values(record).every(
            (packToArt) =>
                isObject<Record<string, unknown>>(packToArt) &&
                Object.values(packToArt).every(
                    (art) =>
                        isObject<Record<string, unknown>>(art) &&
                        typeof art.actor === "string" &&
                        (typeof art.token === "string" ||
                            (isObject<{ img: string; scale: number }>(art.token) &&
                                typeof art.token.img === "string" &&
                                (art.token.scale === undefined || typeof art.token.scale === "number")))
                )
        )
    );
}

interface ModuleArt {
    actor: ImagePath;
    // Token art can either be an image path or an object containing the path and a custom scale
    token: ImagePath | { img: ImagePath; scale?: number };
}

type ModuleArtRecord = Record<string, Record<string, ModuleArt>>;

export { registerModuleArt, ModuleArt };
