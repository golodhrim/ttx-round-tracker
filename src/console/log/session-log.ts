// src/console/log/session-log.ts
import type { App } from "obsidian";
import type { SessionConfig, RoundState, RollResult, ActionFile } from "../console.types";
import { outcomeLabel } from "../dice/roller";

function formatRollLine(result: RollResult): string {
    const parts = [
        `D20(${result.d20})`,
        `${result.roleModifier >= 0 ? "+" : ""}Role(${result.roleModifier >= 0 ? "+" : ""}${result.roleModifier})`
    ];
    if (result.bonusTotal) parts.push(`+Bonuses(+${result.bonusTotal})`);
    if (result.delegationBonus) {
        parts.push(`+[delegation: +${result.delegationBonus}]`);
    }
    return `${parts.join(" ")} = **${result.total}** vs DC ${result.dc}`;
}

function formatParticipantBlock(
    result: RollResult,
    action: ActionFile,
    helperResult: RollResult | null
): string {
    const lines: string[] = [];
    lines.push(`**${result.player}** · ${action.actionText}`);
    lines.push(`Roll: ${formatRollLine(result)}`);
    if (helperResult && result.delegationHelper) {
        lines.push(
            `*(Delegation from ${result.delegationHelper}: ` +
            `D12(${result.delegationD12}) + Role(+${helperResult.roleModifier}) = ` +
            `+${result.delegationBonus} — see ${result.delegationHelper}'s entry below)*`
        );
    }
    const secondary = result.secondaryDie
        ? ` · D${result.secondaryDie.die}: ${result.secondaryDie.result}`
        : "";
    lines.push(`Outcome: ${outcomeLabel(result.tier)} (${result.margin >= 0 ? "+" : ""}${result.margin})${secondary}`);
    if (result.revealText) {
        lines.push(`> "${result.revealText}"`);
    }
    return lines.join("\n");
}

function formatDelegatingBlock(
    helper: string,
    primaryResult: RollResult
): string {
    const lines: string[] = [];
    lines.push(`**${helper}** → assisting ${primaryResult.player}`);
    lines.push(
        `D12(${primaryResult.delegationD12}) + Role(+${primaryResult.delegationBonus - (primaryResult.delegationD12 ?? 0)}) = ` +
        `**+${primaryResult.delegationBonus}** contributed to ${primaryResult.player}'s total`
    );
    if (primaryResult.tier !== "failure" && primaryResult.tier !== "critical-failure") {
        lines.push(`*(Unavailable next round — coordination cost)*`);
    }
    return lines.join("\n");
}

export async function appendRoundToLog(
    app: App,
    config: SessionConfig,
    state: RoundState,
    roundCloseText: string
): Promise<void> {
    const now = new Date().toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit"
    });
    const lines: string[] = [
        ``,
        `## Round ${state.round} — ${config.sessionDate} ${now}`,
        ``,
        `---`,
        ``
    ];

    // Delegation map: target → helper name
    const delegationMap = Object.fromEntries(
        Object.values(state.declarations)
            .filter((a) => a.mode === "delegate" && a.delegationTarget)
            .map((a) => [a.delegationTarget!, a.player])
    );

    for (const p of config.participants) {
        const action = state.declarations[p.name];
        if (!action) continue;

        if (action.mode === "skip") {
            lines.push(`**${p.name}** — passed this round`);
        } else if (action.mode === "delegate") {
            const primaryResult = state.results[action.delegationTarget!];
            if (primaryResult) {
                lines.push(formatDelegatingBlock(p.name, primaryResult));
            }
        } else {
            const result = state.results[p.name];
            if (!result) continue;
            const helperName = delegationMap[p.name];
            const helperResult = helperName ? state.results[helperName] : null;
            lines.push(formatParticipantBlock(result, action, helperResult));
        }
        lines.push(``);
        lines.push(`---`);
        lines.push(``);
    }

    if (roundCloseText.trim()) {
        lines.push(`⚡ **SGM — Round ${state.round} close:** "${roundCloseText.trim()}"`);
        lines.push(``);
        lines.push(`---`);
        lines.push(``);
    }

    const block = lines.join("\n");

    // Ensure the output file exists (create parent folders if needed)
    const outputPath = config.sessionOutputFile;
    const parentDir = outputPath.substring(0, outputPath.lastIndexOf("/"));
    if (parentDir && !(await app.vault.adapter.exists(parentDir))) {
        await app.vault.createFolder(parentDir);
    }

    if (!(await app.vault.adapter.exists(outputPath))) {
        const header = [
            `# ${config.sessionName}`,
            ``,
            `**Date:** ${config.sessionDate}`,
            `**Participants:** ${config.participants.map((p) => p.name).join(", ")}`,
            ``
        ].join("\n");
        await app.vault.adapter.write(outputPath, header);
    }

    // Append the round block
    const existing = await app.vault.adapter.read(outputPath);
    await app.vault.adapter.write(outputPath, existing + block);
}
