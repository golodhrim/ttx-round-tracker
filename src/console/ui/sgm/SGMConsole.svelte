<!-- src/console/ui/sgm/SGMConsole.svelte -->
<script lang="ts">
    import type InitiativeTracker from "../../../main";
    import type { SessionConfig, ActionFile, RollResult } from "../../console.types";
    import { roundStore } from "../../stores/round";
    import { sessionStore } from "../../stores/session";
    import { readAllActionFiles, resolveConflicts } from "../../io/action-file";
    import { rollD, determineOutcome, triggerSecondaryDie } from "../../dice/roller";
    import { appendRoundToLog } from "../../log/session-log";
    import PhaseBar from "./PhaseBar.svelte";
    import ParticipantRow from "./ParticipantRow.svelte";
    import SpecialRulesBar from "./SpecialRulesBar.svelte";
    import { get } from "svelte/store";
    import { onMount, onDestroy } from "svelte";
    import type { TAbstractFile } from "obsidian";

    export let plugin: InitiativeTracker;
    export let config: SessionConfig;

    type ConsoleTab = "round" | "log";
    let activeTab: ConsoleTab = "round";

    // --- Session log state ---
    let logContent = "";
    let logSaving = false;
    let logError = "";

    async function loadLog() {
        try {
            logContent = await plugin.app.vault.adapter.read(config.sessionOutputFile);
            logError = "";
        } catch {
            logContent = "";
            logError = "Session log not yet created — it will appear here after the first round is finalized.";
        }
    }

    async function saveLog() {
        logSaving = true;
        try {
            await plugin.app.vault.adapter.write(config.sessionOutputFile, logContent);
        } finally {
            logSaving = false;
        }
    }

    let logWatchHandler: ((file: TAbstractFile) => void) | null = null;

    onMount(() => {
        loadLog();
        logWatchHandler = (file: TAbstractFile) => {
            if (file.path === config.sessionOutputFile && activeTab !== "log") {
                // Silently reload when not actively editing
                loadLog();
            }
        };
        plugin.app.vault.on("modify", logWatchHandler);
    });

    onDestroy(() => {
        if (logWatchHandler) plugin.app.vault.off("modify", logWatchHandler);
    });

    // --- Round flow state ---
    $: round = $roundStore;
    $: activeParticipants = config.participants.filter(
        (p) => round.declarations[p.name]?.mode !== "skip" &&
               round.declarations[p.name]?.mode !== "delegate"
    );
    $: declaredCount = Object.keys(round.declarations).length;
    $: allDeclared = declaredCount === config.participants.length;
    $: allDCsSet = activeParticipants.every((p) => round.dcs[p.name] != null);
    $: allRevealed = activeParticipants.every(
        (p) => (round.results[p.name]?.revealText ?? "").trim().length > 0
    );

    $: delegationMap = Object.fromEntries(
        Object.values(round.declarations)
            .filter((a) => a.mode === "delegate" && a.delegationTarget)
            .map((a) => [a.delegationTarget!, a.player])
    );

    let roundCloseText = "";
    let pollingTimer: ReturnType<typeof setInterval>;

    $: if (round.phase === "declare") {
        if (!pollingTimer) pollingTimer = setInterval(pollActions, 3000);
    } else {
        if (pollingTimer) { clearInterval(pollingTimer); pollingTimer = undefined; }
    }

    async function pollActions() {
        const files = await readAllActionFiles(
            plugin.app,
            config.actionsFolder,
            config.participants.map((p) => p.name)
        );
        const { resolved } = resolveConflicts(files);
        Object.entries(resolved).forEach(([name, action]) => {
            roundStore.setDeclaration(name, action);
        });
    }

    function rollAll() {
        roundStore.advancePhase("roll");
        const state = get(roundStore);
        for (const p of activeParticipants) {
            const action = state.declarations[p.name];
            const dc = state.dcs[p.name] ?? 10;
            const helperName = delegationMap[p.name];
            const helperParticipant = helperName
                ? config.participants.find((q) => q.name === helperName)
                : null;

            const d20 = rollD(20);
            const bonusTotal = action?.bonuses
                .filter((b) => b.active)
                .reduce((s, b) => s + b.value, 0) ?? 0;
            const pendingMod = config.pendingModifiers[p.name] ?? 0;

            let delegationD12: number | null = null;
            let delegationBonus = 0;
            if (helperParticipant) {
                delegationD12 = rollD(12);
                delegationBonus = delegationD12 + helperParticipant.delegationModifier;
            }

            const total = d20 + p.roleModifier + bonusTotal + pendingMod + delegationBonus;
            const tier = determineOutcome(total, dc, d20);
            const secondary = triggerSecondaryDie(tier);

            const result: RollResult = {
                player: p.name,
                d20,
                roleModifier: p.roleModifier,
                bonusTotal,
                delegationBonus,
                delegationHelper: helperName ?? null,
                delegationD12,
                total,
                dc,
                margin: total - dc,
                tier,
                secondaryDie: secondary,
                revealText: ""
            };
            roundStore.setResult(p.name, result);
        }
        roundStore.advancePhase("reveal");
    }

    function updateReveal(playerName: string, text: string) {
        const current = get(roundStore).results[playerName];
        if (!current) return;
        roundStore.setResult(playerName, { ...current, revealText: text });
    }

    async function finalizeRound() {
        const state = get(roundStore);

        // Apply coordination costs and partial failure modifiers
        for (const p of activeParticipants) {
            const result = state.results[p.name];
            if (!result) continue;
            if (result.tier === "partial-failure") {
                sessionStore.setPendingModifier(plugin.app, p.name, -1);
            } else {
                sessionStore.clearPendingModifier(plugin.app, p.name);
            }
        }
        // Delegation coordination cost
        for (const [target, helper] of Object.entries(delegationMap)) {
            const result = state.results[target];
            if (result && result.tier !== "failure" && result.tier !== "critical-failure") {
                sessionStore.setPendingModifier(plugin.app, helper, -99);
            }
        }

        await appendRoundToLog(plugin.app, config, state, roundCloseText);
        sessionStore.incrementRound(plugin.app);
        roundStore.reset(config.currentRound + 1);
        roundCloseText = "";
        // Reload log after finalize
        await loadLog();
    }
</script>

<div class="sgm-console">
    <div class="console-tabs">
        <button class:active={activeTab === "round"} on:click={() => { activeTab = "round"; }}>⚙ Round</button>
        <button class:active={activeTab === "log"} on:click={() => { activeTab = "log"; loadLog(); }}>📋 Session Log</button>
    </div>

    {#if activeTab === "round"}
        <PhaseBar
            round={config.currentRound}
            phase={round.phase}
            declaredCount={declaredCount}
            totalActive={config.participants.length}
        />

        <SpecialRulesBar {config} />

        <div class="participants">
            {#each config.participants as p}
                {#if round.declarations[p.name]?.mode !== "delegate"}
                    <ParticipantRow
                        name={p.name}
                        phase={round.phase}
                        action={round.declarations[p.name] ?? null}
                        dc={round.dcs[p.name] ?? null}
                        result={round.results[p.name] ?? null}
                        helperName={delegationMap[p.name] ?? null}
                        helperAction={delegationMap[p.name]
                            ? round.declarations[delegationMap[p.name]] ?? null
                            : null}
                        helperResult={delegationMap[p.name]
                            ? round.results[p.name] ?? null
                            : null}
                        onDCChange={(dc) => roundStore.setDC(p.name, dc)}
                        onRevealChange={(text) => updateReveal(p.name, text)}
                    />
                {/if}
            {/each}
        </div>

        <div class="phase-actions">
            {#if round.phase === "declare"}
                <button class="mod-cta" disabled={!allDeclared} on:click={() => roundStore.advancePhase("dc-set")}>
                    All declared → Set DCs
                </button>
                <button on:click={pollActions}>↻ Refresh</button>
            {:else if round.phase === "dc-set"}
                <div class="dc-quickset">
                    {#each [6,8,10,12,14,16,18,20] as v}
                        <button class="dc-quick" on:click={() => {
                            activeParticipants.forEach(p => { if (round.dcs[p.name] == null) roundStore.setDC(p.name, v); });
                        }}>{v}</button>
                    {/each}
                </div>
                <button class="mod-cta" disabled={!allDCsSet} on:click={rollAll}>
                    🎲 Roll All
                </button>
            {:else if round.phase === "reveal"}
                <div class="round-close">
                    <textarea
                        bind:value={roundCloseText}
                        placeholder="SGM round close — overall narrative (optional)…"
                        rows="2"
                    />
                </div>
                <button class="mod-cta" disabled={!allRevealed} on:click={finalizeRound}>
                    ✓ Finalize Round {config.currentRound} → Write Log
                </button>
            {/if}
        </div>
    {:else}
        <div class="log-tab">
            <div class="log-toolbar">
                <span class="log-path">{config.sessionOutputFile}</span>
                <button on:click={loadLog} title="Reload from disk">↻</button>
                <button class="mod-cta" on:click={saveLog} disabled={logSaving}>
                    {logSaving ? "Saving…" : "Save"}
                </button>
            </div>
            {#if logError && !logContent}
                <p class="log-empty">{logError}</p>
            {:else}
                <textarea
                    class="log-editor"
                    bind:value={logContent}
                    spellcheck="false"
                />
            {/if}
        </div>
    {/if}
</div>

<style>
    .sgm-console { display: flex; flex-direction: column; height: 100%; font-size: var(--font-small); }

    .console-tabs { display: flex; border-bottom: 1px solid var(--background-modifier-border); flex-shrink: 0; }
    .console-tabs button { flex: 1; border: none; border-bottom: 2px solid transparent; padding: 4px 6px; font-size: var(--font-smallest); cursor: pointer; background: transparent; color: var(--text-muted); }
    .console-tabs button.active { border-bottom-color: var(--interactive-accent); color: var(--interactive-accent); font-weight: 600; }

    .participants { flex: 1; overflow: auto; padding: 6px; }
    .phase-actions { border-top: 1px solid var(--background-modifier-border); padding: 8px; display: flex; flex-direction: column; gap: 6px; }
    .dc-quickset { display: flex; gap: 4px; flex-wrap: wrap; }
    .dc-quick { padding: 2px 8px; font-size: var(--font-smallest); }
    .round-close textarea { width: 100%; resize: vertical; }

    .log-tab { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
    .log-toolbar { display: flex; align-items: center; gap: 4px; padding: 4px 6px; border-bottom: 1px solid var(--background-modifier-border); flex-shrink: 0; }
    .log-path { flex: 1; font-size: var(--font-smallest); color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .log-editor { flex: 1; width: 100%; resize: none; font-size: var(--font-smallest); font-family: var(--font-monospace); padding: 0.5rem; border: none; background: var(--background-primary); color: var(--text-normal); }
    .log-empty { color: var(--text-muted); padding: 1rem; font-style: italic; font-size: var(--font-small); }
</style>
