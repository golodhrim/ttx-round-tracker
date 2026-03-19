<script lang="ts">
    import { ExtraButtonComponent } from "obsidian";

    import CreatureTemplate from "./Participant.svelte";

    import { DICE } from "src/utils";
    import { Participant, getId } from "src/utils/participant";
    import { createEventDispatcher } from "svelte";
    import { dndzone } from "svelte-dnd-action";
    import { flip } from "svelte/animate";

    import { tracker } from "../../stores/tracker";
    import type InitiativeTracker from "src/main";
    import { getContext } from "svelte";

    const plugin = getContext<InitiativeTracker>("plugin");
    const { state, ordered } = tracker;

    $: items = [...$ordered].map((c) => {
        return { participant: c, id: getId() };
    });

    const dispatch = createEventDispatcher();

    const flipDurationMs = 300;
    function handleDndConsider(
        e: CustomEvent<GenericDndEvent<{ participant: Participant; id: string }[]>>
    ) {
        items = e.detail.items;
    }
    function handleDndFinalize(
        e: CustomEvent<GenericDndEvent<{ participant: Participant; id: string }[]>>
    ) {
        if (e.detail.items.length > 1) {
            let dropped = e.detail.items.find(
                ({ id }) => id == e.detail.info.id
            );
            const index = e.detail.items.findIndex(
                (c) => c.id == e.detail.info.id
            );
            if (index == e.detail.items.length - 1) {
                dropped.participant.initiative =
                    e.detail.items[index - 1].participant.initiative;
            } else {
                dropped.participant.initiative =
                    e.detail.items[index + 1].participant.initiative;
            }
            tracker.logNewInitiative(dropped.participant);
        }
        items = e.detail.items;
        $tracker = [...items.map(({ participant }, i) => {
            participant.manualOrder = i;
            return participant;
        })];
    }

    const diceIcon = (node: HTMLElement) => {
        new ExtraButtonComponent(node).setIcon(DICE);
    };
</script>

<table class="initiative-tracker-table">
    {#if $ordered.length}
        <thead class="tracker-table-header">
            <td
                style="width: 10%;"
                use:diceIcon
                aria-label="Re-Roll Initiatives"
                on:click={() => tracker.roll(plugin)}
            />
            <th class="left" style="width:80%">Name</th>
            <th style="width:10%" />
        </thead>
        <tbody
            use:dndzone={{
                items,
                flipDurationMs,
                dropTargetStyle: {},
                morphDisabled: true
            }}
            on:consider={handleDndConsider}
            on:finalize={handleDndFinalize}
        >
            {#each items as { participant, id } (id)}
                <tr
                    class="draggable initiative-tracker-creature"
                    class:disabled={!participant.enabled}
                    class:active={$state && participant.active}
                    class:viewing={participant.viewing}
                    class:friendly={participant.friendly}
                    animate:flip={{ duration: flipDurationMs }}
                    on:click={(e) => {
                        dispatch("open-combatant", participant);
                        e.stopPropagation();
                    }}
                >
                    <CreatureTemplate
                        {participant}
                        on:tag
                        on:edit
                        on:open-combatant
                    />
                </tr>
            {/each}
        </tbody>
    {:else}
        <div class="no-participants">
            <p>Add a participant to get started!</p>
            <small>Participants may be created in settings.</small>
        </div>
    {/if}
</table>

<style scoped>
    .no-participants {
        margin: 1rem;
        text-align: center;
    }
    .initiative-tracker-table {
        padding: 0.5rem;
        align-items: center;
        gap: 0.25rem 0.5rem;
        width: 100%;
        margin-left: 0rem;
        table-layout: fixed;
        border-collapse: separate;
        border-spacing: 0 2px;
    }
    .left {
        text-align: left;
    }
    .tracker-table-header {
        font-weight: bolder;
        display: contents;
    }
    .initiative-tracker-creature {
        position: relative;
    }
    .initiative-tracker-creature.active {
        background-color: rgba(0, 0, 0, 0.1);
    }
    :global(.theme-dark) .initiative-tracker-creature.active {
        background-color: rgba(255, 255, 255, 0.1);
    }
    .initiative-tracker-creature.disabled :global(*) {
        color: var(--text-faint);
    }
    .initiative-tracker-creature :global(td) {
        border-top: 1px solid transparent;
        border-bottom: 1px solid transparent;
    }
    .initiative-tracker-creature :global(td:first-child) {
        border-left: 1px solid transparent;
    }
    .initiative-tracker-creature :global(td:last-child) {
        border-right: 1px solid transparent;
    }
    .initiative-tracker-creature:hover :global(td),
    .initiative-tracker-creature.viewing :global(td) {
        border-top: 1px solid var(--background-modifier-border);
        border-bottom: 1px solid var(--background-modifier-border);
    }
    .initiative-tracker-creature:hover :global(td:first-child),
    .initiative-tracker-creature.viewing :global(td:first-child) {
        border-left: 1px solid var(--background-modifier-border);
    }
    .initiative-tracker-creature:hover :global(td:last-child),
    .initiative-tracker-creature.viewing :global(td:last-child) {
        border-right: 1px solid var(--background-modifier-border);
    }
</style>
