// src/console/console.types.ts

export interface PlayerBonus {
    name: string;
    value: number;
    active: boolean;
}

export interface SessionParticipant {
    name: string;
    roleModifier: number;
    delegationModifier: number;
    bonuses: PlayerBonus[];
    specialRule?: string;
}

export interface SessionConfig {
    sessionName: string;
    sessionDate: string;           // YYYY-MM-DD
    charactersFolder: string;      // e.g. "02 Characters/2026"
    participants: SessionParticipant[];
    sessionOutputFile: string;     // e.g. "04 Sessions/2026/2026-03-18-TTX-session.md"
    actionsFolder: string;         // e.g. "04 Sessions/2026/actions"
    status: "active" | "finalized";
    currentRound: number;
    specialRulesUsed: {
        phoneCall: string[];       // player names who have used it
        cLevelOverride: string[];
        certReroll: string[];
    };
    pendingModifiers: Record<string, number>; // player name → modifier (e.g. -1 for partial failure)
}

export type ActionMode = "act" | "delegate" | "skip";

export interface ActionFile {
    round: number;
    player: string;
    mode: ActionMode;
    actionText: string;
    bonuses: PlayerBonus[];
    delegationTarget: string | null;
    delegationText: string;
    skipped: boolean;
    submittedAt: string;           // ISO 8601
}

export type OutcomeTier =
    | "critical-failure"
    | "failure"
    | "partial-failure"
    | "bare-success"
    | "clean-success"
    | "strong-success"
    | "critical-success";

export interface RollResult {
    player: string;
    d20: number;                   // raw D20 value (1–20)
    roleModifier: number;
    bonusTotal: number;            // sum of active bonuses
    delegationBonus: number;       // D12 + helper modifier, 0 if none
    delegationHelper: string | null;
    delegationD12: number | null;
    total: number;                 // d20 + roleModifier + bonusTotal + delegationBonus
    dc: number;
    margin: number;                // total - dc (negative = miss)
    tier: OutcomeTier;
    secondaryDie: { die: number; result: number } | null;
    revealText: string;            // SGM fills in phase 4
}

export interface RoundState {
    round: number;
    phase: "declare" | "dc-set" | "roll" | "reveal";
    declarations: Record<string, ActionFile>;   // player name → action
    dcs: Record<string, number>;                // player name → DC
    results: Record<string, RollResult>;        // player name → roll result
    roundCloseText: string;
}
