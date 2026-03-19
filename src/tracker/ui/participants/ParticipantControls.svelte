<script lang="ts">
    import { ExtraButtonComponent, Menu } from "obsidian";
    import {
        DISABLE,
        ENABLE,
        HIDDEN,
        REMOVE,
        TAG
    } from "src/utils";
    import type { Participant } from "src/utils/participant";
    import type TrackerView from "src/tracker/view";
    import { createEventDispatcher, getContext } from "svelte";
    import type InitiativeTracker from "src/main";
    import { tracker } from "src/tracker/stores/tracker";

    const dispatch = createEventDispatcher();

    export let participant: Participant;

    const plugin = getContext<InitiativeTracker>("plugin");

    const hamburgerIcon = (node: HTMLElement) => {
        const hamburger = new ExtraButtonComponent(node)
            .setIcon("vertical-three-dots")
            .setTooltip("Actions");
        hamburger.extraSettingsEl.onclick = (evt) => {
            evt.stopPropagation();
            const menu = new Menu();
            menu.addItem((item) => {
                item.setIcon(TAG)
                    .setTitle("Apply Status")
                    .onClick((e: MouseEvent) => {
                        tracker.setUpdate(participant, e);
                    });
            });
            menu.addItem((item) => {
                item.setIcon("pencil")
                    .setTitle("Edit")
                    .onClick(() => {
                        dispatch("edit", participant);
                    });
            });
            if (participant.hidden) {
                menu.addItem((item) => {
                    item.setIcon("eye")
                        .setTitle("Show")
                        .onClick(() => {
                            tracker.updateParticipants({
                                participant,
                                change: { hidden: false }
                            });
                        });
                });
            } else {
                menu.addItem((item) => {
                    item.setIcon(HIDDEN)
                        .setTitle("Hide")
                        .onClick(() => {
                            tracker.updateParticipants({
                                participant,
                                change: { hidden: true }
                            });
                        });
                });
            }
            if (participant.enabled) {
                menu.addItem((item) => {
                    item.setIcon(DISABLE)
                        .setTitle("Disable")
                        .onClick(() => {
                            tracker.updateParticipants({
                                participant,
                                change: { enabled: false }
                            });
                        });
                });
            } else {
                menu.addItem((item) => {
                    item.setIcon(ENABLE)
                        .setTitle("Enable")
                        .onClick(() => {
                            tracker.updateParticipants({
                                participant,
                                change: { enabled: true }
                            });
                        });
                });
            }
            menu.addItem((item) => {
                item.setIcon(REMOVE)
                    .setTitle("Remove")
                    .onClick(() => {
                        tracker.remove(participant);
                    });
            });
            menu.showAtPosition(evt);
        };
    };
</script>

<div class="controls">
    <div class="add-button icon" use:hamburgerIcon />
</div>

<style>
    .controls {
        display: flex;
        justify-content: flex-end;
    }
    .icon :global(.clickable-icon) {
        margin-right: 0;
    }
</style>
