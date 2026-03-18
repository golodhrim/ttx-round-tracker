<!-- src/console/ui/player/SessionLogTab.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import type { App, TAbstractFile } from "obsidian";

    export let app: App;
    export let sessionOutputFile: string;

    let content = "";
    let error = "";
    let unsubscribe: (() => void) | null = null;

    async function loadContent() {
        try {
            content = await app.vault.adapter.read(sessionOutputFile);
        } catch {
            error = "Session log not yet created.";
        }
    }

    onMount(async () => {
        await loadContent();
        const handler = (file: TAbstractFile) => {
            if (file.path === sessionOutputFile) loadContent();
        };
        app.vault.on("modify", handler);
        unsubscribe = () => app.vault.off("modify", handler);
    });

    onDestroy(() => unsubscribe?.());
</script>

<div class="log-tab">
    <div class="readonly-badge">👁 Read-only · Synced · Updates live</div>
    {#if error}
        <p class="empty">{error}</p>
    {:else}
        <pre class="log-content">{content}</pre>
    {/if}
</div>

<style>
    .log-tab { display: flex; flex-direction: column; height: 100%; }
    .readonly-badge { background: var(--background-modifier-hover); padding: 3px 8px; font-size: var(--font-smallest); color: var(--color-orange); border-bottom: 1px solid var(--background-modifier-border); }
    .log-content { flex: 1; overflow: auto; padding: 0.75rem; font-size: var(--font-smallest); white-space: pre-wrap; word-break: break-word; margin: 0; }
    .empty { color: var(--text-muted); padding: 1rem; font-style: italic; }
</style>
