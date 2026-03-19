// src/console/io/character-reader.ts
import { parseYaml } from "obsidian";
import type { App, TFile } from "obsidian";
import type { SessionParticipant, PlayerBonus } from "../console.types";

interface RawStatblock {
    name?: string;
    modifier?: string;
    bonus?: string;
    delegation?: string;
    special?: string;
}

function parseModifier(raw: string | undefined): number {
    if (!raw) return 0;
    const match = raw.match(/([+-]?\d+)/);
    return match ? parseInt(match[1], 10) : 0;
}

function parseBonuses(raw: string | undefined): PlayerBonus[] {
    if (!raw || raw === "~") return [];
    return raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((entry) => {
            // e.g. "Azure +2" or "Security Cert +3"
            const match = entry.match(/^(.+?)\s+([+-]\d+)$/);
            if (!match) return null;
            return {
                name: match[1].trim(),
                value: parseInt(match[2], 10),
                active: false
            };
        })
        .filter((b): b is PlayerBonus => b !== null);
}

function parseDelegationModifier(raw: string | undefined): number {
    if (!raw) return 0;
    // e.g. "Roll D12 + 4 when assisting another player"
    const match = raw.match(/D12\s*\+\s*(\d+)/i);
    return match ? parseInt(match[1], 10) : 0;
}

async function readParticipantFromTFile(
    app: App,
    file: TFile
): Promise<SessionParticipant | null> {
    try {
        const content = await app.vault.read(file);
        // Extract ```statblock ... ``` block — handle both LF and CRLF line endings
        const match = content.match(/```statblock\r?\n([\s\S]*?)```/);
        if (!match) return null;

        const raw = parseYaml(match[1]) as RawStatblock;
        if (!raw?.name) return null;

        return {
            name: raw.name,
            roleModifier: parseModifier(raw.modifier),
            delegationModifier: parseDelegationModifier(raw.delegation),
            bonuses: parseBonuses(raw.bonus),
            specialRule: raw.special && raw.special !== "~" ? raw.special : undefined,
            filePath: file.path
        };
    } catch {
        return null;
    }
}

export async function readParticipantFromFile(
    app: App,
    folder: string,
    filename: string
): Promise<SessionParticipant | null> {
    const abstract = app.vault.getAbstractFileByPath(`${folder}/${filename}`);
    if (!abstract || abstract.constructor.name !== "TFile") return null;
    return readParticipantFromTFile(app, abstract as TFile);
}

export async function readAllParticipants(
    app: App,
    folder: string
): Promise<SessionParticipant[]> {
    // Use vault.getFiles() — works reliably with iCloud and all vault adapters
    const mdFiles = app.vault.getFiles().filter(
        (f) =>
            f.path.startsWith(folder + "/") &&
            f.extension === "md" &&
            !f.path.includes("Player-Template") &&
            !f.path.includes("Player-Registry") &&
            !f.path.includes("Player-Cards")
    );
    const results = await Promise.all(
        mdFiles.map((f) => readParticipantFromTFile(app, f))
    );
    return results.filter((p): p is SessionParticipant => p !== null);
}
