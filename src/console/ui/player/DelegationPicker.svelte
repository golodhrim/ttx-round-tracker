<!-- src/console/ui/player/DelegationPicker.svelte -->
<script lang="ts">
    export let participants: string[];
    export let myName: string;
    export let takenTargets: Set<string>;
    export let delegatingPlayers: Set<string>;
    export let selected: string | null;
    export let delegationText: string = "";

    function isDisabled(name: string) {
        return (
            name === myName ||
            takenTargets.has(name) ||
            delegatingPlayers.has(name)
        );
    }
    function disabledReason(name: string): string {
        if (takenTargets.has(name)) return "already being assisted";
        if (delegatingPlayers.has(name)) return "is delegating";
        return "";
    }
</script>

<div class="picker">
    <p class="label">Who are you assisting?</p>
    {#each participants as name}
        {#if name !== myName}
            <label
                class="player-option"
                class:disabled={isDisabled(name)}
                class:selected={selected === name}
            >
                <input
                    type="radio"
                    bind:group={selected}
                    value={name}
                    disabled={isDisabled(name)}
                />
                <span class="name">{name}</span>
                {#if isDisabled(name)}
                    <span class="reason">{disabledReason(name)}</span>
                {/if}
            </label>
        {/if}
    {/each}

    {#if selected}
        <div class="delegation-desc">
            <p class="label">What are you helping with?</p>
            <textarea
                bind:value={delegationText}
                placeholder="Describe your contribution..."
                rows="2"
            />
        </div>
    {/if}
</div>

<style>
    .picker { display: flex; flex-direction: column; gap: 0.25rem; }
    .label { font-size: var(--font-smallest); text-transform: uppercase; color: var(--text-muted); margin: 0 0 0.25rem 0; }
    .player-option { display: flex; align-items: center; gap: 0.4rem; flex-direction: row; padding: 3px 6px; border-radius: 3px; font-size: var(--font-small); cursor: pointer; border: 1px solid transparent; }
    .player-option.selected { border-color: var(--color-orange); background: var(--background-modifier-hover); }
    .player-option.disabled { opacity: 0.4; cursor: not-allowed; }
    .reason { color: var(--text-muted); font-size: var(--font-smallest); margin-left: auto; font-style: italic; }
    .delegation-desc { margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.25rem; }
    textarea { width: 100%; resize: vertical; font-size: var(--font-small); }
</style>
