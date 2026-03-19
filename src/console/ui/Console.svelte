<!-- src/console/ui/Console.svelte -->
<script lang="ts">
    import type InitiativeTracker from "../../main";
    import { onMount } from "svelte";
    import { sessionStore } from "../stores/session";
    import type { SessionConfig, SessionParticipant } from "../console.types";
    import SessionResume from "./setup/SessionResume.svelte";
    import SessionSetup from "./setup/SessionSetup.svelte";
    import PlayerConsole from "./player/PlayerConsole.svelte";
    import SGMConsole from "./sgm/SGMConsole.svelte";

    export let plugin: InitiativeTracker;

    type Screen = "loading" | "resume" | "setup" | "pick" | "sgm" | "player";
    let screen: Screen = "loading";
    let existingSessionPath: string | null = null;
    let activeConfig: SessionConfig | null = null;
    let activeParticipant: SessionParticipant | null = null;

    onMount(async () => {
        const sessionsBase =
            plugin.data.ttxConsoleSessionsPath + "/" +
            new Date().toISOString().slice(0, 4) + "/.sessions";
        existingSessionPath = await sessionStore.findTodaysSession(
            plugin.app,
            sessionsBase
        );
        screen = existingSessionPath ? "resume" : "setup";
    });

    function afterSession(cfg: SessionConfig) {
        activeConfig = cfg;
        if (plugin.data.ttxConsoleSGM) {
            screen = "sgm";
        } else {
            screen = "pick";
        }
    }

    function pickParticipant(p: SessionParticipant) {
        activeParticipant = p;
        screen = "player";
    }
</script>

<div class="ttx-console-root">
    {#if screen === "loading"}
        <p class="ttx-loading">Loading…</p>

    {:else if screen === "resume" && existingSessionPath}
        <SessionResume
            {plugin}
            existingPath={existingSessionPath}
            onResume={afterSession}
            onNew={() => (screen = "setup")}
        />

    {:else if screen === "setup"}
        <SessionSetup {plugin} onConfigured={afterSession} />

    {:else if screen === "pick" && activeConfig}
        <div class="pick-screen">
            <p class="pick-label">Who are you?</p>
            {#each activeConfig.participants as p}
                <button class="pick-btn" on:click={() => pickParticipant(p)}>
                    {p.name}
                </button>
            {/each}
        </div>

    {:else if screen === "sgm" && activeConfig}
        <SGMConsole {plugin} config={activeConfig} />

    {:else if screen === "player" && activeConfig && activeParticipant}
        <PlayerConsole
            {plugin}
            config={activeConfig}
            participant={activeParticipant}
            onSwitch={() => (screen = "pick")}
        />
    {/if}
</div>

<style>
    .ttx-console-root { height: 100%; overflow: auto; display: flex; flex-direction: column; }
    .ttx-loading { padding: 1rem; color: var(--text-muted); }
    .pick-screen { padding: 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .pick-label { font-size: var(--font-small); color: var(--text-muted); margin: 0 0 0.25rem; }
    .pick-btn { width: 100%; padding: 0.5rem; text-align: left; font-size: var(--font-ui-medium); cursor: pointer; }
</style>
