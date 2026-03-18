<!-- src/console/ui/sgm/DelegationSubRow.svelte -->
<script lang="ts">
    import type { ActionFile, RollResult } from "../../console.types";
    export let helper: string;
    export let action: ActionFile;
    export let result: RollResult | null;
</script>

<div class="sub-row">
    <span class="arrow">↳</span>
    <span class="name">{helper}</span>
    {#if action.delegationText}
        <span class="desc">{action.delegationText}</span>
    {/if}
    {#if result}
        <span class="roll">D12({result.delegationD12}) + Role(+{(result.delegationBonus ?? 0) - (result.delegationD12 ?? 0)}) = +{result.delegationBonus}</span>
        {#if result.tier === "bare-success" || result.tier === "clean-success" || result.tier === "strong-success" || result.tier === "critical-success"}
            <span class="note">Unavailable next round</span>
        {/if}
    {:else}
        <span class="meta">D12 + modifier</span>
    {/if}
</div>

<style>
    .sub-row { display: flex; align-items: center; gap: 0.4rem; padding: 3px 8px 3px 1.5rem; background: var(--background-modifier-hover); border-top: 1px solid var(--background-modifier-border); font-size: var(--font-smallest); flex-wrap: wrap; }
    .arrow { color: var(--color-orange); }
    .name { color: var(--color-orange); font-weight: bold; }
    .desc { color: var(--text-muted); font-style: italic; flex: 1; }
    .roll { color: var(--text-muted); margin-left: auto; }
    .meta { color: var(--text-faint); }
    .note { color: var(--text-faint); font-style: italic; }
</style>
