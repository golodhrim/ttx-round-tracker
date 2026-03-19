<script lang="ts">
    import { FRIENDLY, HIDDEN } from "src/utils";
    import type { Participant } from "src/utils/creature";
    import Initiative from "./Initiative.svelte";
    import CreatureControls from "./CreatureControls.svelte";
    import Status from "./Status.svelte";
    import { setIcon } from "obsidian";
    import { tracker } from "../../stores/tracker";
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();

    export let participant: Participant;
    $: statuses = participant.status;

    const name = () => participant.getName();
    const statblockLink = () => participant.getStatblockLink();
    const hiddenIcon = (div: HTMLElement) => {
        setIcon(div, HIDDEN);
    };
    const friendlyIcon = (div: HTMLElement) => {
        setIcon(div, FRIENDLY);
    };

    let hoverTimeout: NodeJS.Timeout = null;
    const tryHover = (evt: MouseEvent) => {
        hoverTimeout = setTimeout(() => {
            if (participant["statblock-link"]) {
                let link = statblockLink();
                if (/\[.+\]\(.+\)/.test(link)) {
                    [, link] = link.match(/\[.+?\]\((.+?)\)/);
                } else if (/\[\[.+\]\]/.test(link)) {
                    [, link] = link.match(/\[\[(.+?)(?:\|.+?)?\]\]/);
                }
                app.workspace.trigger(
                    "link-hover",
                    {},
                    evt.target,
                    link,
                    "initiative-tracker "
                );
            }
        }, 1000);
    };

    const cancelHover = (_evt: MouseEvent) => {
        clearTimeout(hoverTimeout);
    };
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<td class="initiative-container" on:click={(e) => e.stopPropagation()}>
    <Initiative
        initiative={participant.initiative}
        modifier={[participant.modifier].flat().reduce((a, b) => a + b, 0)}
        on:click={(e) => e.stopPropagation()}
        on:initiative={(e) => {
            tracker.updateParticipants({
                participant,
                change: { initiative: Number(e.detail) }
            });
        }}
    />
</td>
<td class="name-container">
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div
        class="name-holder"
        on:click|stopPropagation={() => dispatch("open-combatant", participant)}
        on:mouseenter={tryHover}
        on:mouseleave={cancelHover}
    >
        {#if participant.hidden}
            <div class="centered-icon" use:hiddenIcon />
        {/if}
        {#if participant.friendly}
            <div class="centered-icon" use:friendlyIcon />
        {/if}
        {#if participant.player}
            <strong class="name player">{participant.name}</strong>
        {:else}
            <span class="name">{name()}</span>
        {/if}
    </div>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div class="statuses" on:click={(e) => e.stopPropagation()}>
        {#if statuses.size}
            {#each [...statuses] as status}
                <Status
                    {status}
                    on:remove={() => {
                        tracker.updateParticipants({
                            participant,
                            change: { remove_status: [status] }
                        });
                    }}
                />
            {/each}
        {/if}
    </div>
</td>

<td class="controls-container">
    <CreatureControls
        on:click={(e) => e.stopPropagation()}
        on:tag
        on:edit
        {participant}
    />
</td>

<style scoped>
    .name-holder {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        font-size: small;
    }
    .centered-icon {
        display: flex;
        align-items: center;
    }
    .name {
        display: block;
        text-align: left;
        background-color: inherit;
        border: 0;
        padding: 0;
        height: unset;
        word-break: keep-all;
    }
    .statuses {
        display: flex;
        flex-flow: row wrap;
        column-gap: 0.25rem;
    }
    .initiative-container {
        border-top-left-radius: 0.25rem;
        border-bottom-left-radius: 0.25rem;
    }
    .controls-container {
        border-top-right-radius: 0.25rem;
        border-bottom-right-radius: 0.25rem;
    }
</style>
