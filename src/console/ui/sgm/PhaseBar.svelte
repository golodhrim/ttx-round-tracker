<!-- src/console/ui/sgm/PhaseBar.svelte -->
<script lang="ts">
    import type { RoundState } from "../../console.types";
    export let round: number;
    export let phase: RoundState["phase"];
    export let declaredCount: number;
    export let totalActive: number;

    const phaseLabels: Record<RoundState["phase"], string> = {
        "declare": "1 — Declare",
        "dc-set": "2 — DC Set",
        "roll": "3 — Roll",
        "reveal": "4 — Reveal"
    };
</script>

<div class="phase-bar">
    <span class="round">Round {round}</span>
    <div class="phases">
        {#each Object.entries(phaseLabels) as [key, label]}
            <span class="phase" class:active={phase === key}>{label}</span>
        {/each}
    </div>
    {#if phase === "declare"}
        <span class="count">{declaredCount}/{totalActive}</span>
    {/if}
</div>

<style>
    .phase-bar { display: flex; align-items: center; gap: 0.5rem; padding: 4px 8px; background: var(--background-secondary); border-bottom: 1px solid var(--background-modifier-border); font-size: var(--font-smallest); flex-shrink: 0; flex-wrap: wrap; }
    .round { font-weight: bold; color: var(--text-normal); }
    .phases { display: flex; gap: 4px; flex: 1; }
    .phase { padding: 2px 6px; border-radius: 10px; color: var(--text-muted); }
    .phase.active { background: var(--interactive-accent); color: var(--text-on-accent); }
    .count { color: var(--color-orange); font-weight: bold; }
</style>
