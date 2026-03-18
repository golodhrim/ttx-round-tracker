<!-- src/console/ui/setup/SessionSetup.svelte -->
<script lang="ts">
    import type InitiativeTracker from "../../../main";
    import { readAllParticipants } from "../../io/character-reader";
    import { sessionStore } from "../../stores/session";
    import type { SessionConfig, SessionParticipant } from "../../console.types";

    export let plugin: InitiativeTracker;
    export let onConfigured: (cfg: SessionConfig) => void;

    const today = new Date().toISOString().slice(0, 10);
    let sessionName = `TTX Game Day ${today.slice(0, 4)}`;
    let sessionDate = today;
    let charactersFolder = "02 Characters/" + today.slice(0, 4);
    let sessionOutputFile = `04 Sessions/${today.slice(0, 4)}/${today}-TTX-session.md`;
    let actionsFolder = `04 Sessions/${today.slice(0, 4)}/actions`;

    let availableParticipants: SessionParticipant[] = [];
    let selectedNames: Set<string> = new Set();
    let loading = false;
    let folderError = "";

    async function loadParticipants() {
        loading = true;
        folderError = "";
        availableParticipants = await readAllParticipants(plugin.app, charactersFolder);
        if (!availableParticipants.length) {
            folderError = "No character files found in this folder.";
        }
        loading = false;
    }

    function toggleParticipant(name: string) {
        if (selectedNames.has(name)) selectedNames.delete(name);
        else selectedNames.add(name);
        selectedNames = new Set(selectedNames);
    }

    async function startSession() {
        const selected = availableParticipants.filter((p) =>
            selectedNames.has(p.name)
        );
        if (!selected.length) return;

        const sessionsBasePath = plugin.data.ttxConsoleSessionsPath +
            `/${today.slice(0, 4)}/.sessions`;

        const cfg: SessionConfig = {
            sessionName,
            sessionDate,
            charactersFolder,
            participants: selected,
            sessionOutputFile,
            actionsFolder,
            status: "active",
            currentRound: 1,
            specialRulesUsed: { phoneCall: [], cLevelOverride: [], certReroll: [] },
            pendingModifiers: {}
        };

        await sessionStore.create(plugin.app, cfg, sessionsBasePath);
        onConfigured(cfg);
    }
</script>

<div class="ttx-setup">
    <h3>New TTX Session</h3>

    <label>Session name
        <input type="text" bind:value={sessionName} />
    </label>

    <label>Session date
        <input type="date" bind:value={sessionDate} />
    </label>

    <label>Characters folder
        <div class="row">
            <input type="text" bind:value={charactersFolder} />
            <button on:click={loadParticipants}>Load</button>
        </div>
        {#if folderError}<p class="error">{folderError}</p>{/if}
    </label>

    {#if availableParticipants.length}
        <div class="participant-list">
            <p class="label">Select participants</p>
            {#each availableParticipants as p}
                <label class="participant-item">
                    <input
                        type="checkbox"
                        checked={selectedNames.has(p.name)}
                        on:change={() => toggleParticipant(p.name)}
                    />
                    <span class="name">{p.name}</span>
                    <span class="modifier">+{p.roleModifier}</span>
                </label>
            {/each}
        </div>
    {/if}

    <label>Session output file
        <input type="text" bind:value={sessionOutputFile} />
    </label>

    <label>Actions folder
        <input type="text" bind:value={actionsFolder} />
    </label>

    <button
        class="mod-cta"
        disabled={!selectedNames.size}
        on:click={startSession}
    >
        Start session →
    </button>
</div>

<style>
    .ttx-setup { padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem; font-size: var(--font-small); }
    label { display: flex; flex-direction: column; gap: 0.25rem; }
    input[type="text"], input[type="date"] { width: 100%; }
    .row { display: flex; gap: 0.5rem; }
    .participant-list { display: flex; flex-direction: column; gap: 0.25rem; border: 1px solid var(--background-modifier-border); border-radius: 4px; padding: 0.5rem; }
    .participant-item { display: flex; align-items: center; gap: 0.5rem; flex-direction: row; }
    .modifier { color: var(--color-blue); font-size: var(--font-smallest); margin-left: auto; }
    .error { color: var(--color-red); font-size: var(--font-smallest); }
    .label { font-size: var(--font-smallest); text-transform: uppercase; color: var(--text-muted); margin: 0; }
</style>
