<!-- src/console/ui/Console.svelte -->
<script lang="ts">
    import type InitiativeTracker from "../../main";
    import { onMount } from "svelte";
    import { sessionStore } from "../stores/session";
    import type { SessionConfig } from "../console.types";
    import SessionResume from "./setup/SessionResume.svelte";
    import SessionSetup from "./setup/SessionSetup.svelte";
    import PlayerConsole from "./player/PlayerConsole.svelte";
    import SGMConsole from "./sgm/SGMConsole.svelte";

    export let plugin: InitiativeTracker;

    type Screen = "loading" | "resume" | "setup" | "sgm" | "player";
    let screen: Screen = "loading";
    let existingSessionPath: string | null = null;
    let activeConfig: SessionConfig | null = null;

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

    function onResume(cfg: SessionConfig) {
        activeConfig = cfg;
        screen = plugin.data.ttxConsoleSGM ? "sgm" : "player";
    }

    function onConfigured(cfg: SessionConfig) {
        activeConfig = cfg;
        screen = plugin.data.ttxConsoleSGM ? "sgm" : "player";
    }
</script>

<div class="ttx-console-root">
    {#if screen === "loading"}
        <p class="ttx-loading">Loading…</p>
    {:else if screen === "resume" && existingSessionPath}
        <SessionResume
            {plugin}
            existingPath={existingSessionPath}
            {onResume}
            onNew={() => (screen = "setup")}
        />
    {:else if screen === "setup"}
        <SessionSetup {plugin} {onConfigured} />
    {:else if screen === "sgm" && activeConfig}
        <SGMConsole {plugin} config={activeConfig} />
    {:else if screen === "player" && activeConfig}
        <PlayerConsole
            {plugin}
            config={activeConfig}
            participant={activeConfig.participants[0]}
        />
    {/if}
</div>

<style>
    .ttx-console-root { height: 100%; overflow: auto; }
    .ttx-loading { padding: 1rem; color: var(--text-muted); }
</style>
