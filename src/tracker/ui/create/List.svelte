<script lang="ts">
    import { ExtraButtonComponent, setIcon } from "obsidian";
    import {
        AC,
        DEFAULT_UNDEFINED,
        FRIENDLY,
        HIDDEN,
        HP,
        INITIATIVE,
    } from "src/utils";
    import type { Participant } from "src/utils/creature";
    import type { Writable } from "svelte/store";

    export let adding: Writable<Array<[Participant, number]>>;
    export let editing: Writable<Participant>;

    const minusIcon = (node: HTMLElement, _participant: Participant) => {
        new ExtraButtonComponent(node).setIcon("minus");
    };
    const minus = (evt: MouseEvent, index: number) => {
        if ($adding[index][1] - 1 < 1) {
            del(evt, index);
            return;
        }
        $adding[index][1] -= 1;
        $adding = $adding;
    };
    const plusIcon = (node: HTMLElement, _participant: Participant) => {
        new ExtraButtonComponent(node).setIcon("plus");
    };
    const add = (evt: MouseEvent, index: number) => {
        $adding[index][1] += 1;
        $adding = $adding;
    };
    const delIcon = (node: HTMLElement, _participant: Participant) => {
        new ExtraButtonComponent(node).setIcon("trash");
    };
    const del = (evt: MouseEvent, index: number) => {
        $adding.splice(index, 1);
        $adding = $adding;
    };
    const heart = (node: HTMLElement) => {
        setIcon(node, HP);
    };
    const ac = (node: HTMLElement) => {
        setIcon(node, AC);
    };
    const init = (node: HTMLElement) => {
        setIcon(node, INITIATIVE);
    };
    const hidden = (node: HTMLElement) => {
        setIcon(node, HIDDEN);
    };
    const friendly = (node: HTMLElement) => {
        setIcon(node, FRIENDLY);
    };
</script>

<h5 class="list-header">Participants</h5>
<div class="initiative-tracker-list">
    {#if $adding.length}
        {#each $adding as [participant, number], index}
            <div class="participant" on:click={() => ($editing = participant)}>
                <div class="participant-metadata">
                    <div class="participant-name">{participant.getName()}</div>
                    <div class="participant-amount">
                        <div
                            class="participant-minus"
                            use:minusIcon={participant}
                            on:click|stopPropagation={(evt) =>
                                minus(evt, index)}
                        />
                        <div class="participant-number">{number}</div>
                        <div
                            class="participant-minus"
                            use:plusIcon={participant}
                            on:click|stopPropagation={(evt) => add(evt, index)}
                        />
                        <div
                            class="participant-delete"
                            use:delIcon={participant}
                            on:click|stopPropagation={(evt) => del(evt, index)}
                        />
                    </div>
                </div>
                <small class="participant-data">
                    <span>
                        {participant.hp ?? DEFAULT_UNDEFINED}
                        <span use:heart />
                        <span>
                            {participant.ac ?? DEFAULT_UNDEFINED}
                            <span use:ac />
                        </span>
                        <span>
                            {participant.initiative ?? DEFAULT_UNDEFINED}
                            <span use:init />
                        </span>
                        {#if participant.hidden}
                            <span use:hidden />
                        {/if}
                        {#if participant.friendly}
                            <span use:friendly />
                        {/if}
                    </span>
                </small>
            </div>
        {/each}
    {:else}
        <span>Add a participant.</span>
    {/if}
</div>

<style scoped>
    .initiative-tracker-list {
        display: flex;
        flex: 1 1 auto;
        flex-flow: column nowrap;
        /* gap: 0.5rem; */
        height: 0px;
        overflow: scroll;
    }

    .participant {
        border-radius: 0.5rem;
        padding: 0.5rem;
    }
    .participant:hover {
        background-color: var(--background-secondary);
    }

    .participant-metadata {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    .participant-amount {
        margin-left: auto;
        display: grid;
        grid-template-columns: 1fr 1fr 1fr 1fr;
        align-items: center;
        text-align: center;
    }
    .participant-data {
        --icon-size: 10px;
        display: flex;
        align-items: center;
        gap: 0.375rem;
    }
    .list-header {
        margin-top: 0;
        margin-bottom: 0.5rem;
    }
</style>
