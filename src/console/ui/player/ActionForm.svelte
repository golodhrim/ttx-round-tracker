<!-- src/console/ui/player/ActionForm.svelte -->
<script lang="ts">
    import type { App } from "obsidian";
    import type { SessionParticipant, ActionFile, ActionMode } from "../../console.types";
    import BonusCheckboxes from "./BonusCheckboxes.svelte";
    import DelegationPicker from "./DelegationPicker.svelte";
    import { writeActionFile } from "../../io/action-file";

    export let app: App;
    export let participant: SessionParticipant;
    export let allParticipants: string[];
    export let actionsFolder: string;
    export let currentRound: number;
    export let takenTargets: Set<string>;
    export let delegatingPlayers: Set<string>;
    export let pendingModifier: number;
    export let onSubmit: (action: ActionFile) => void;

    let mode: ActionMode = "act";
    let actionText = "";
    let delegationTarget: string | null = null;
    let delegationText = "";
    let bonuses = participant.bonuses.map((b) => ({ ...b, active: false }));
    let submitted = false;

    $: bonusTotal = bonuses.filter((b) => b.active).reduce((s, b) => s + b.value, 0);
    $: rollPreview = mode === "delegate"
        ? `D12 + Role(${participant.delegationModifier >= 0 ? "+" : ""}${participant.delegationModifier})`
        : `D20 + Role(+${participant.roleModifier})${bonusTotal ? ` + Bonuses(+${bonusTotal})` : ""}${pendingModifier ? ` + carry-over(${pendingModifier})` : ""}`;

    async function submit() {
        const action: ActionFile = {
            round: currentRound,
            player: participant.name,
            mode,
            actionText: mode === "act" ? actionText : "",
            bonuses,
            delegationTarget: mode === "delegate" ? delegationTarget : null,
            delegationText: mode === "delegate" ? delegationText : "",
            skipped: mode === "skip",
            submittedAt: new Date().toISOString()
        };
        await writeActionFile(app, actionsFolder, action);
        submitted = true;
        onSubmit(action);
    }
</script>

<div class="action-form">
    <p class="round-label">Round {currentRound}</p>

    {#if pendingModifier !== 0}
        <div class="carry-over">
            ⚠ Partial failure carry-over: {pendingModifier} to this roll
        </div>
    {/if}

    <div class="mode-toggle">
        <button
            class:active={mode === "act"}
            on:click={() => (mode = "act")}
            disabled={submitted}
        >Act independently</button>
        <button
            class:active={mode === "delegate"}
            on:click={() => (mode = "delegate")}
            disabled={submitted}
        >↳ Delegate</button>
        <button
            class:active={mode === "skip"}
            on:click={() => (mode = "skip")}
            disabled={submitted}
        >— Skip</button>
    </div>

    {#if mode === "act"}
        <textarea
            bind:value={actionText}
            placeholder="What do you want to do this round?"
            rows="3"
            disabled={submitted}
        />
        <BonusCheckboxes bind:bonuses />

    {:else if mode === "delegate"}
        <DelegationPicker
            participants={allParticipants}
            myName={participant.name}
            {takenTargets}
            {delegatingPlayers}
            bind:selected={delegationTarget}
            bind:delegationText
        />
        <div class="warning">⚠ You cannot act independently this round once submitted</div>

    {:else if mode === "skip"}
        <p class="skip-note">You will pass this round — no roll, no DC.</p>
    {/if}

    <div class="roll-preview">{rollPreview}</div>

    {#if !submitted}
        <button
            class="mod-cta submit-btn"
            on:click={submit}
            disabled={
                (mode === "act" && !actionText.trim()) ||
                (mode === "delegate" && (!delegationTarget || !delegationText.trim()))
            }
        >
            Submit →
        </button>
    {:else}
        <div class="submitted-badge">✓ Submitted — waiting for SGM</div>
    {/if}
</div>

<style>
    .action-form { display: flex; flex-direction: column; gap: 0.6rem; padding: 0.5rem; font-size: var(--font-small); }
    .round-label { font-size: var(--font-smallest); text-transform: uppercase; color: var(--text-muted); margin: 0; }
    .carry-over { background: var(--background-modifier-error); border-radius: 4px; padding: 4px 8px; font-size: var(--font-smallest); }
    .mode-toggle { display: flex; border: 1px solid var(--background-modifier-border); border-radius: 4px; overflow: hidden; }
    .mode-toggle button { flex: 1; border: none; border-radius: 0; padding: 4px 0; font-size: var(--font-small); cursor: pointer; background: transparent; }
    .mode-toggle button.active { background: var(--interactive-accent); color: var(--text-on-accent); }
    textarea { width: 100%; resize: vertical; }
    .warning { color: var(--color-red); font-size: var(--font-smallest); }
    .skip-note { color: var(--text-muted); font-style: italic; }
    .roll-preview { background: var(--background-secondary); border-radius: 3px; padding: 4px 8px; font-size: var(--font-smallest); color: var(--color-blue); }
    .submit-btn { width: 100%; }
    .submitted-badge { text-align: center; color: var(--color-green); font-size: var(--font-small); padding: 4px; }
</style>
