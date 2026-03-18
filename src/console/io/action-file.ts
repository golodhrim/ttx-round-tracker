// src/console/io/action-file.ts
import type { App } from "obsidian";
import type { ActionFile } from "../console.types";

export async function writeActionFile(
    app: App,
    actionsFolder: string,
    action: ActionFile
): Promise<void> {
    const safeName = action.player.replace(/\s+/g, "-");
    const path = `${actionsFolder}/${safeName}-action.json`;
    await app.vault.adapter.write(path, JSON.stringify(action, null, 2));
}

export async function readActionFile(
    app: App,
    actionsFolder: string,
    playerName: string
): Promise<ActionFile | null> {
    const safeName = playerName.replace(/\s+/g, "-");
    const path = `${actionsFolder}/${safeName}-action.json`;
    try {
        const raw = await app.vault.adapter.read(path);
        return JSON.parse(raw) as ActionFile;
    } catch {
        return null;
    }
}

export async function readAllActionFiles(
    app: App,
    actionsFolder: string,
    participants: string[]
): Promise<Record<string, ActionFile>> {
    const results: Record<string, ActionFile> = {};
    await Promise.all(
        participants.map(async (name) => {
            const action = await readActionFile(app, actionsFolder, name);
            if (action) results[name] = action;
        })
    );
    return results;
}

/** Resolve delegation conflicts: first submittedAt wins. */
export function resolveConflicts(
    actions: Record<string, ActionFile>
): { resolved: Record<string, ActionFile>; conflicts: string[] } {
    const targetMap: Map<string, { player: string; at: number }> = new Map();
    const conflicts: string[] = [];

    // Sort by submission time so we process earliest first
    const sorted = Object.entries(actions).sort(
        ([, a], [, b]) =>
            new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
    );

    const resolved = Object.fromEntries(
        sorted.map(([name, action]) => [name, { ...action }])
    );

    for (const [name, action] of sorted) {
        if (action.mode !== "delegate" || !action.delegationTarget) continue;
        const target = action.delegationTarget;
        if (targetMap.has(target)) {
            // Conflict: revert this player to "act"
            resolved[name] = { ...action, mode: "act", delegationTarget: null };
            conflicts.push(name);
        } else {
            targetMap.set(target, {
                player: name,
                at: new Date(action.submittedAt).getTime()
            });
        }
    }
    return { resolved, conflicts };
}
