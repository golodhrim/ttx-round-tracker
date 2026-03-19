<!-- src/console/ui/player/PlayerConsole.svelte -->
<script lang="ts">
    import type InitiativeTracker from "../../../main";
    import type { SessionConfig, SessionParticipant, ActionFile } from "../../console.types";
    import ActionForm from "./ActionForm.svelte";
    import SessionLogTab from "./SessionLogTab.svelte";
    import { roundStore } from "../../stores/round";
    import { MarkdownRenderer } from "obsidian";
    import { onMount } from "svelte";

    export let plugin: InitiativeTracker;
    export let config: SessionConfig;
    export let participant: SessionParticipant;
    export let onSwitch: () => void;

    type Tab = "character" | "action" | "log" | "notes";
    let activeTab: Tab = "action";
    let logHasUpdate = false;
    let notes = "";
    let cardEl: HTMLElement;
    let cardError = "";

    $: round = $roundStore;

    $: takenTargets = new Set(
        Object.values(round.declarations)
            .filter((a) => a.mode === "delegate" && a.delegationTarget)
            .map((a) => a.delegationTarget!)
    );
    $: delegatingPlayers = new Set(
        Object.values(round.declarations)
            .filter((a) => a.mode === "delegate")
            .map((a) => a.player)
    );

    $: pendingModifier = config.pendingModifiers[participant.name] ?? 0;

    function onActionSubmit(action: ActionFile) {
        roundStore.setDeclaration(participant.name, action);
    }

    function switchTab(tab: Tab) {
        activeTab = tab;
        if (tab === "log") logHasUpdate = false;
        if (tab === "character") renderCard();
    }

    async function renderCard() {
        cardError = "";
        if (!cardEl) return;
        cardEl.empty();
        if (!participant.filePath) {
            cardError = "Character file path not available.";
            return;
        }
        try {
            const content = await plugin.app.vault.adapter.read(participant.filePath);
            await MarkdownRenderer.render(plugin.app, content, cardEl, participant.filePath, plugin);
        } catch {
            cardError = "Could not load character card.";
        }
    }

    onMount(() => {
        // Pre-render if character tab is active by default
        if (activeTab === "character") renderCard();
    });
</script>

<div class="player-console">
    <div class="player-header">
        <span class="player-name">{participant.name}</span>
        <button class="switch-btn" on:click={onSwitch} title="Switch character">⇄</button>
    </div>

    <div class="tabs">
        <button class:active={activeTab === "character"} on:click={() => switchTab("character")}>🃏 My Character</button>
        <button class:active={activeTab === "action"} on:click={() => switchTab("action")}>🎲 My Action</button>
        <button class:active={activeTab === "log"} on:click={() => switchTab("log")}>
            📋 Session Log {#if logHasUpdate}<span class="dot">●</span>{/if}
        </button>
        <button class:active={activeTab === "notes"} on:click={() => switchTab("notes")}>📓 My Notes</button>
    </div>

    <div class="tab-content">
        {#if activeTab === "character"}
            {#if cardError}
                <p class="card-error">{cardError}</p>
            {/if}
            <div class="card-container" bind:this={cardEl}></div>
        {:else if activeTab === "action"}
            <ActionForm
                app={plugin.app}
                {participant}
                allParticipants={config.participants.map((p) => p.name)}
                actionsFolder={config.actionsFolder}
                currentRound={config.currentRound}
                {takenTargets}
                {delegatingPlayers}
                {pendingModifier}
                onSubmit={onActionSubmit}
            />
        {:else if activeTab === "log"}
            <SessionLogTab
                app={plugin.app}
                sessionOutputFile={config.sessionOutputFile}
            />
        {:else if activeTab === "notes"}
            <div class="notes-tab">
                <p class="private-note">Not synced — stays on this device only</p>
                <textarea bind:value={notes} placeholder="Your personal notes..." rows="15" />
            </div>
        {/if}
    </div>
</div>

<style>
    .player-console { display: flex; flex-direction: column; height: 100%; }
    .player-header { display: flex; align-items: center; padding: 4px 8px; border-bottom: 1px solid var(--background-modifier-border); gap: 6px; flex-shrink: 0; }
    .player-name { flex: 1; font-weight: 600; font-size: var(--font-small); }
    .switch-btn { border: none; background: transparent; cursor: pointer; color: var(--text-muted); font-size: 1rem; padding: 0 4px; }
    .tabs { display: flex; border-bottom: 1px solid var(--background-modifier-border); flex-shrink: 0; }
    .tabs button { flex: 1; border: none; border-bottom: 2px solid transparent; padding: 5px 2px; font-size: var(--font-smallest); cursor: pointer; background: transparent; }
    .tabs button.active { border-bottom-color: var(--interactive-accent); color: var(--interactive-accent); }
    .dot { color: var(--color-orange); }
    .tab-content { flex: 1; overflow: auto; }
    .card-container { padding: 0.5rem; }
    .card-error { color: var(--text-muted); padding: 1rem; font-style: italic; font-size: var(--font-small); }
    .notes-tab { padding: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem; height: 100%; }
    .private-note { font-size: var(--font-smallest); color: var(--text-muted); font-style: italic; margin: 0; }
    textarea { flex: 1; resize: none; width: 100%; }
</style>
