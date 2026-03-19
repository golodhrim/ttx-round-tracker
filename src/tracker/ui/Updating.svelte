<script lang="ts">
    import { ExtraButtonComponent, TextComponent, setIcon } from "obsidian";
    import type InitiativeTracker from "src/main";
    import { REMOVE, TAG } from "src/utils";
    import { ConditionSuggestionModal } from "src/utils/suggester";
    import { getContext } from "svelte";
    import { getId } from "src/utils/participant";
    import Status from "src/tracker/ui/participants/Status.svelte";

    import { tracker } from "../stores/tracker";
    const { updating } = tracker;
    import { writable } from "svelte/store";
    import type { Condition } from "src/types/participants";

    const plugin = getContext<InitiativeTracker>("plugin");

    const tagIcon = (node: HTMLElement) => {
        setIcon(node, TAG);
    };
    let statusBtn: ExtraButtonComponent;
    const addStatusIcon = (node: HTMLElement) => {
        statusBtn = new ExtraButtonComponent(node).setIcon("plus-circle");
    };
    const removeIcon = (node: HTMLElement) => {
        setIcon(node, REMOVE);
    };
    const checkIcon = (node: HTMLElement) => {
        setIcon(node, "check");
    };
    const cancelIcon = (node: HTMLElement) => {
        setIcon(node, "cross-in-box");
    };

    let status: string = null;
    $: {
        if (statusBtn) statusBtn.setDisabled(!status);
    }
    const statuses = writable<Condition[]>([]);
    const addStatus = () => {
        if (status) {
            $statuses = [
                ...$statuses,
                {
                    ...(plugin.data.statuses.find((s) => s.name == status) ?? {
                        name: status,
                        id: getId(),
                        description: ""
                    })
                }
            ];
            status = null;
            modal.items = plugin.data.statuses
                .filter((s) => !$statuses.find((a) => a.id == s.id))
                .map((s) => s.name);
            conditionText.setValue("");
        }
    };

    let modal: ConditionSuggestionModal;
    let conditionText: TextComponent;
    const conditionDiv = (node: HTMLElement) => {
        conditionText = new TextComponent(node);
        conditionText.onChange((v) => (status = v));
        node.onkeydown = (evt) => {
            if (evt.key === "Enter") {
                status ? addStatus() : performUpdate(true);
            }
        };
        createModal();
    };
    const createModal = () => {
        modal = new ConditionSuggestionModal(
            plugin.app,
            conditionText,
            plugin.data.statuses
                .filter((s) => !$statuses.find((a) => a.id == s.id))
                .map((s) => s.name)
        );
        modal.onSelect(async ({ item }) => {
            status = item;
            conditionText.setValue(item);
            modal.close();
            addStatus();
        });
    };

    const performUpdate = (perform: boolean) => {
        if (perform) {
            tracker.doUpdate("", $statuses, "");
        } else {
            tracker.clearUpdate();
        }
        status = null;
        $statuses = [];
        modal = null;
    };
</script>

{#if $updating.size}
    <div class="updating-container">
        <div class="status-row">
            {#if plugin.data.beginnerTips}
                <small class="label">Apply status effect to selected participants</small>
            {/if}
            <div class="input-status">
                <div class="input">
                    <div
                        use:tagIcon
                        aria-label="Apply status effect"
                        style="margin: 0 0.2rem 0 0.7rem"
                    />
                    <div use:conditionDiv />
                </div>
                <div
                    use:addStatusIcon
                    aria-label="Add Status"
                    on:click={addStatus}
                    style="margin: 0rem 0.2rem 0rem 0rem"
                />
            </div>
            {#if $statuses.length}
                <div class="status-list">
                    <div
                        use:removeIcon
                        aria-label="Clear status list"
                        style="margin:0.2rem 0.2rem 0rem 0.7rem;cursor:pointer;"
                        on:click={() => { $statuses = []; }}
                    />
                    <div class="status-list-entries">
                        {#each $statuses as s}
                            <Status
                                status={s}
                                on:remove={() => {
                                    $statuses = $statuses.filter((x) => x !== s);
                                }}
                            />
                        {/each}
                    </div>
                </div>
            {/if}
        </div>
    </div>
    <div style="margin: 0.5rem">
        <table class="updating-participant-table">
            <thead class="updating-participant-table-header">
                <th style="width:100%" class="left">Name</th>
                <th />
            </thead>
            <tbody>
                {#each [...$updating.entries()] as [participant, _update], i}
                    <tr class="updating-participant-table-row">
                        <td>
                            <span>
                                {participant.name +
                                    (participant.number
                                        ? " " + participant.number
                                        : "")}
                            </span>
                        </td>
                        <td
                            use:removeIcon
                            on:click={(evt) => {
                                tracker.setUpdate(participant, evt);
                                if (!$updating.size) {
                                    $statuses = [];
                                    modal = null;
                                }
                            }}
                            style="cursor:pointer"
                        />
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
    <div class="updating-buttons">
        <span
            use:checkIcon
            on:click={() => performUpdate(true)}
            style="cursor:pointer"
            aria-label="Apply"
        />
        <span
            use:cancelIcon
            on:click={() => performUpdate(false)}
            style="cursor:pointer"
            aria-label="Cancel"
        />
    </div>
{:else}
    <div on:load={() => performUpdate(false)} />
{/if}

<style scoped>
    .input {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    :global(.is-disabled) {
        cursor: not-allowed;
    }
    .input-status {
        display: flex;
        justify-content: space-between;
    }
    .input > div,
    .input-status > div,
    td:has(> svg),
    th:has(> svg) {
        display: flex;
        align-items: center;
    }
    .status-list {
        display: flex;
        margin: 0.5rem 0 0.1rem 0;
    }
    .status-list-entries {
        display: flex;
        flex-flow: row wrap;
        column-gap: 0.25rem;
        margin: 0 2rem 0 0.5rem;
    }
    .left {
        text-align: left;
    }
    .status-row {
        display: flex;
        flex-flow: column;
        gap: 0.5rem;
    }
    .updating-container {
        display: flex;
        flex-flow: column nowrap;
        gap: 0.5rem;
    }
    .updating-buttons {
        display: flex;
        justify-content: flex-end;
        gap: 1rem;
        margin-right: 0.7rem;
    }
</style>
