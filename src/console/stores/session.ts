// src/console/stores/session.ts
import { writable, get } from "svelte/store";
import type { App } from "obsidian";
import type { SessionConfig } from "../console.types";

function createSessionStore() {
    const config = writable<SessionConfig | null>(null);
    const configPath = writable<string | null>(null);

    async function load(app: App, path: string): Promise<void> {
        try {
            const raw = await app.vault.adapter.read(path);
            config.set(JSON.parse(raw));
            configPath.set(path);
        } catch {
            config.set(null);
        }
    }

    async function save(app: App): Promise<void> {
        const path = get(configPath);
        const cfg = get(config);
        if (!path || !cfg) return;
        await app.vault.adapter.write(path, JSON.stringify(cfg, null, 2));
    }

    async function create(
        app: App,
        cfg: SessionConfig,
        sessionsBasePath: string
    ): Promise<void> {
        const filename = `${cfg.sessionDate}-${cfg.sessionName.replace(/\s+/g, "-")}.json`;
        const fullPath = `${sessionsBasePath}/${filename}`;
        // Ensure sessions directory exists
        if (!(await app.vault.adapter.exists(sessionsBasePath))) {
            await app.vault.createFolder(sessionsBasePath);
        }
        // Ensure actions directory exists
        if (!(await app.vault.adapter.exists(cfg.actionsFolder))) {
            await app.vault.createFolder(cfg.actionsFolder);
        }
        await app.vault.adapter.write(fullPath, JSON.stringify(cfg, null, 2));
        config.set(cfg);
        configPath.set(fullPath);
    }

    async function findTodaysSession(
        app: App,
        sessionsBasePath: string
    ): Promise<string | null> {
        const today = new Date().toISOString().slice(0, 10);
        try {
            const { files } = await app.vault.adapter.list(sessionsBasePath);
            return files.find((f) => f.includes(today) && f.endsWith(".json")) ?? null;
        } catch {
            return null;
        }
    }

    function incrementRound(app: App) {
        config.update((cfg) => {
            if (!cfg) return cfg;
            cfg.currentRound += 1;
            return cfg;
        });
        save(app);
    }

    function markSpecialRuleUsed(
        app: App,
        rule: keyof SessionConfig["specialRulesUsed"],
        playerName: string
    ) {
        config.update((cfg) => {
            if (!cfg) return cfg;
            if (!cfg.specialRulesUsed[rule].includes(playerName)) {
                cfg.specialRulesUsed[rule].push(playerName);
            }
            return cfg;
        });
        save(app);
    }

    function setPendingModifier(app: App, playerName: string, mod: number) {
        config.update((cfg) => {
            if (!cfg) return cfg;
            cfg.pendingModifiers[playerName] = mod;
            return cfg;
        });
        save(app);
    }

    function clearPendingModifier(app: App, playerName: string) {
        config.update((cfg) => {
            if (!cfg) return cfg;
            delete cfg.pendingModifiers[playerName];
            return cfg;
        });
        save(app);
    }

    return {
        subscribe: config.subscribe,
        configPath,
        load,
        save,
        create,
        findTodaysSession,
        incrementRound,
        markSpecialRuleUsed,
        setPendingModifier,
        clearPendingModifier
    };
}

export const sessionStore = createSessionStore();
