import { RpgSystem } from "./rpgSystem";
import type { GenericCreature, DifficultyLevel, DifficultyThreshold } from "./index";

/**
 * TTX RPG System — Cybersecurity Tabletop Exercise
 *
 * Based on CRM (Crew Resource Management) principles from aviation.
 * No XP, no CR, no difficulty tiers. Participants roll D20 + role modifier
 * against a DC set by the SGM. The exercise has no win/lose condition.
 */
export class TtxRpgSystem extends RpgSystem {
    systemDifficulties: [string, string, ...string[]] = ["DC 6", "DC 20"];
    displayName = "TTX (Cybersecurity Tabletop Exercise)";
    valueUnit = "";

    getCreatureDifficulty(): number {
        return 0;
    }

    getEncounterDifficulty(): DifficultyLevel {
        return {
            displayName: "",
            cssClass: "",
            value: 0,
            title: "",
            summary: "",
            intermediateValues: []
        };
    }

    getDifficultyThresholds(): DifficultyThreshold[] {
        return [];
    }

    formatDifficultyValue(): string {
        return "";
    }
}
