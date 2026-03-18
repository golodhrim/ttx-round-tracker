<!-- src/console/ui/sgm/ParticipantRow.svelte -->
<script lang="ts">
    import type { ActionFile, RollResult, RoundState } from "../../console.types";
    import { outcomeLabel } from "../../dice/roller";
    import DelegationSubRow from "./DelegationSubRow.svelte";

    export let name: string;
    export let phase: RoundState["phase"];
    export let action: ActionFile | null;
    export let dc: number | null;
    export let result: RollResult | null;
    export let helperAction: ActionFile | null;
    export let helperName: string | null;
    export let helperResult: RollResult | null;
    export let onDCChange: (dc: number) => void;
    export let onRevealChange: (text: string) => void;

    const DC_LABELS: [number, string][] = [
        [6, "Trivial"], [8, "Easy"], [10, "Moderate"], [12, "Challenging"],
        [14, "Hard"], [16, "Very Hard"], [18, "Extreme"], [20, "Near-impossible"]
    ];

    function dcLabel(n: number): string {
        return DC_LABELS.find(([v]) => v === n)?.[1] ?? "";
    }

    $: tierClass = result ? result.tier : "";
    $: isSkipped = action?.mode === "skip";
    $: isDelegating = action?.mode === "delegate";
</script>

<div class="participant-row" class:skipped={isSkipped} class:delegating={isDelegating}>
    <div class="main-row">
        <span class="name">{name}</span>

        {#if isSkipped}
            <span class="skip-badge">— skipped</span>
        {:else if isDelegating}
            <span class="delegate-badge">↳ → {action?.delegationTarget}</span>
        {:else if action}
            <span class="action-text">{action.actionText}</span>
        {:else}
            <span class="waiting">⏳ waiting…</span>
        {/if}

        {#if !isSkipped && !isDelegating}
            {#if phase === "dc-set" || phase === "roll" || phase === "reveal"}
                <div class="dc-control">
                    <input
                        type="number"
                        min="6" max="20" step="2"
                        value={dc ?? ""}
                        on:change={(e) => onDCChange(parseInt(e.currentTarget.value, 10))}
                    />
                    <span class="dc-label">{dc ? dcLabel(dc) : ""}</span>
                </div>
            {/if}

            {#if result}
                <div class="result {tierClass}">
                    {outcomeLabel(result.tier)}
                    <span class="margin">({result.margin >= 0 ? "+" : ""}{result.margin})</span>
                    {#if result.secondaryDie}
                        <span class="secondary">D{result.secondaryDie.die}: {result.secondaryDie.result}</span>
                    {/if}
                </div>
            {/if}
        {/if}

        {#if helperName && !isSkipped}
            <span class="helper-badge">+ {helperName} assisting</span>
        {/if}
    </div>

    {#if helperName && helperAction}
        <DelegationSubRow
            helper={helperName}
            action={helperAction}
            result={helperResult}
        />
    {/if}

    {#if phase === "reveal" && result && !isSkipped && !isDelegating}
        <div class="reveal-row">
            <textarea
                placeholder="SGM reveal — what happened…"
                rows="2"
                value={result.revealText}
                on:input={(e) => onRevealChange(e.currentTarget.value)}
            />
        </div>
    {/if}
</div>

<style>
    .participant-row { border: 1px solid var(--background-modifier-border); border-radius: 4px; margin-bottom: 3px; overflow: hidden; }
    .main-row { display: flex; align-items: center; gap: 0.4rem; padding: 5px 7px; flex-wrap: wrap; font-size: var(--font-small); }
    .name { font-weight: bold; color: var(--color-blue); min-width: 80px; }
    .action-text { flex: 1; color: var(--text-muted); font-style: italic; font-size: var(--font-smallest); }
    .waiting { flex: 1; color: var(--text-faint); }
    .skip-badge { flex: 1; color: var(--text-faint); font-style: italic; }
    .delegate-badge { flex: 1; color: var(--color-orange); font-size: var(--font-smallest); }
    .dc-control { display: flex; align-items: center; gap: 4px; }
    .dc-control input { width: 40px; text-align: center; }
    .dc-label { font-size: var(--font-smallest); color: var(--text-muted); }
    .result { padding: 2px 6px; border-radius: 3px; font-size: var(--font-smallest); font-weight: bold; }
    .result.clean-success, .result.strong-success, .result.critical-success, .result.bare-success { background: var(--background-modifier-success-hover); color: var(--color-green); }
    .result.partial-failure { background: var(--background-modifier-hover); color: var(--color-yellow); }
    .result.failure, .result.critical-failure { background: var(--background-modifier-error-hover); color: var(--color-red); }
    .margin { font-weight: normal; color: var(--text-muted); }
    .secondary { color: var(--color-purple); }
    .helper-badge { background: var(--background-modifier-hover); border: 1px solid var(--color-orange); border-radius: 10px; padding: 1px 6px; font-size: var(--font-smallest); color: var(--color-orange); }
    .reveal-row { padding: 4px 7px; border-top: 1px solid var(--background-modifier-border); }
    .reveal-row textarea { width: 100%; resize: vertical; font-size: var(--font-small); }
    .skipped { opacity: 0.5; }
</style>
