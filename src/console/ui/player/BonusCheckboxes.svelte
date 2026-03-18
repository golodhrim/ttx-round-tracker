<!-- src/console/ui/player/BonusCheckboxes.svelte -->
<script lang="ts">
    import type { PlayerBonus } from "../../console.types";
    export let bonuses: PlayerBonus[];

    function toggle(bonus: PlayerBonus) {
        bonus.active = !bonus.active;
        bonuses = [...bonuses];
    }
</script>

{#if bonuses.length}
    <div class="bonus-list">
        <p class="label">Which bonuses apply?</p>
        {#each bonuses as bonus}
            <label class="bonus-item" class:active={bonus.active}>
                <input
                    type="checkbox"
                    bind:checked={bonus.active}
                    on:change={() => toggle(bonus)}
                />
                {bonus.name}
                <span class="val">{bonus.value > 0 ? "+" : ""}{bonus.value}</span>
            </label>
        {/each}
    </div>
{/if}

<style>
    .bonus-list { display: flex; flex-direction: column; gap: 0.2rem; }
    .label { font-size: var(--font-smallest); text-transform: uppercase; color: var(--text-muted); margin: 0 0 0.25rem 0; }
    .bonus-item { display: flex; align-items: center; gap: 0.4rem; flex-direction: row; font-size: var(--font-small); padding: 2px 4px; border-radius: 3px; cursor: pointer; }
    .bonus-item.active { background: var(--background-modifier-success-hover); }
    .val { color: var(--color-green); margin-left: auto; font-size: var(--font-smallest); }
</style>
