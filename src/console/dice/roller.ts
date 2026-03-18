// src/console/dice/roller.ts
import type { OutcomeTier } from "../console.types";

export function rollD(sides: number): number {
    return Math.floor(Math.random() * sides) + 1;
}

export function determineOutcome(
    total: number,
    dc: number,
    rawD20: number
): OutcomeTier {
    if (rawD20 === 1) return "critical-failure";
    if (rawD20 === 20) return "critical-success";
    const margin = total - dc;
    if (margin <= -6) return "critical-failure";
    if (margin <= -3) return "failure";
    if (margin <= -1) return "partial-failure";
    if (margin === 0) return "bare-success";
    if (margin <= 3) return "clean-success";
    return "strong-success";
}

export function triggerSecondaryDie(
    tier: OutcomeTier
): { die: number; result: number } | null {
    if (tier === "critical-failure") return { die: 4, result: rollD(4) };
    if (tier === "failure") return { die: 6, result: rollD(6) };
    if (tier === "strong-success" || tier === "critical-success")
        return { die: 8, result: rollD(8) };
    return null;
}

export function outcomeLabel(tier: OutcomeTier): string {
    const labels: Record<OutcomeTier, string> = {
        "critical-failure": "💀 Critical Failure",
        "failure": "✗ Failure",
        "partial-failure": "◑ Partial Failure",
        "bare-success": "◎ Bare Success",
        "clean-success": "✓ Clean Success",
        "strong-success": "⬆ Strong Success",
        "critical-success": "⭐ Critical Success"
    };
    return labels[tier];
}
