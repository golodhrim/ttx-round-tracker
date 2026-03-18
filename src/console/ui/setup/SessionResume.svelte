<!-- src/console/ui/setup/SessionResume.svelte -->
<script lang="ts">
    import type InitiativeTracker from "../../../main";
    import { sessionStore } from "../../stores/session";
    import type { SessionConfig } from "../../console.types";

    export let plugin: InitiativeTracker;
    export let existingPath: string;
    export let onResume: (cfg: SessionConfig) => void;
    export let onNew: () => void;

    async function resume() {
        await sessionStore.load(plugin.app, existingPath);
        const raw = await plugin.app.vault.adapter.read(existingPath);
        onResume(JSON.parse(raw) as SessionConfig);
    }
</script>

<div class="ttx-setup">
    <h3>TTX Console</h3>
    <p>A session from today was found. Would you like to resume it?</p>
    <p class="path">{existingPath.split("/").pop()}</p>
    <div class="actions">
        <button class="mod-cta" on:click={resume}>Resume session</button>
        <button on:click={onNew}>Start new session</button>
    </div>
</div>

<style>
    .ttx-setup { padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
    .path { color: var(--text-muted); font-size: var(--font-small); font-style: italic; }
    .actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
</style>
