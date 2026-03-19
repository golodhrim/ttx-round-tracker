<script lang="ts">
    import { setIcon } from "obsidian";
    import { fade } from "svelte/transition";
    import { SyncLoader } from "svelte-loading-spinners";

    import { FRIENDLY, INITIATIVE } from "src/utils";
    import type { Participant } from "src/utils/creature";

    import { tracker } from "../stores/tracker";
    const { state, ordered } = tracker;

    const iniIcon = (node: HTMLElement) => {
        setIcon(node, INITIATIVE);
    };

    const amIActive = (participant: Participant) => {
        if (participant.hidden) return false;
        if (participant.active) return true;

        const active = $ordered.findIndex((c) => c.active);
        const index = $ordered.indexOf(participant);
        if (active == -1 || active < index) return false;

        const remaining = $ordered.slice(index + 1, active + 1);
        if (remaining.every((c) => c.hidden)) return true;
        return false;
    };

    $: activeAndVisible = $ordered.filter((c) => c.enabled && !c.hidden);

    const name = (participant: Participant) => participant.getName();
    const friendIcon = (node: HTMLElement) => {
        setIcon(node, FRIENDLY);
    };
</script>

<table class="initiative-tracker-table" transition:fade>
    <thead class="tracker-table-header">
        <th style="width:5%"><strong use:iniIcon /></th>
        <th class="left" style="width:50%"><strong>Name</strong></th>
        <th><strong>Statuses</strong></th>
    </thead>
    <tbody>
        {#each activeAndVisible as participant (participant.id)}
            <tr class:active={amIActive(participant) && $state}>
                <td class="center">{participant.initiative}</td>
                <td class="name">
                    {name(participant)}
                </td>
                <td class="center">
                    {[...participant.status].map((s) => s.name).join(", ")}
                </td>
            </tr>
        {/each}
    </tbody>
</table>

<style scoped>
    .initiative-tracker-table {
        padding: 0.5rem;
        align-items: center;
        gap: 0.25rem 0.5rem;
        width: 100%;
        margin-left: 0rem;
        table-layout: fixed;
        border-collapse: separate;
        border-spacing: 0 2px;
        font-size: larger;
    }
    .left {
        text-align: left;
    }
    .name, .name > :global(svg) {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    .center {
        text-align: center;
    }
    .active {
        background-color: rgba(0, 0, 0, 0.1);
    }
    :global(.theme-dark) .active {
        background-color: rgba(255, 255, 255, 0.1);
    }
</style>
