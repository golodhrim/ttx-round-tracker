<script lang="ts">
    import {
        ExtraButtonComponent,
        Notice,
        TextComponent,
        Platform
    } from "obsidian";

    import { onMount } from "svelte";

    import { DICE } from "src/utils";
    import { Participant } from "src/utils/participant";
    import type InitiativeTracker from "src/main";
    import type { Writable } from "svelte/store";
    import { equivalent } from "src/encounter";
    import { confirmWithModal } from "./modal";

    let creature: Participant = new Participant({});
export let plugin: InitiativeTracker;
    export let adding: Writable<Array<[Participant, number]>>;
    export let editing: Writable<Participant>;
    export let isEditing: boolean;

    editing.subscribe((c) => {
        if (!c) return;
        creature = c;
    });

    let modifier = JSON.stringify(creature.modifier ?? 0);
    const prior = modifier;

    const saveButton = (node: HTMLElement) => {
        new ExtraButtonComponent(node)
            .setTooltip("Add Participant")
            .setIcon("plus")
            .onClick(async () => {
                if (!creature || !creature.name || !creature.name?.length) {
                    new Notice("Enter a name!");
                    return;
                }
                try { creature.modifier = JSON.parse(`${modifier}`); }
                catch (e) { creature.modifier = JSON.parse(prior); }
                if (!creature.modifier) creature.modifier = JSON.parse(prior);

                if (creature.initiative <= 0 || creature.initiative == null || isNaN(creature.initiative)) {
                    creature.initiative = await plugin.getInitiativeValue(creature.modifier);
                }
                let existing = $adding.findIndex(([k]) => equivalent(k, creature));
                if (existing > -1) { $adding[existing][1] += 1; }
                else { $adding.push([creature, 1]); }
                $adding = $adding;
                $editing = null;
                creature = new Participant({});
            });
    };

    const editButton = (node: HTMLElement) => {
        new ExtraButtonComponent(node)
            .setTooltip("Save Participant")
            .setIcon("save")
            .onClick(async () => {
                if (!creature || !creature.name || !creature.name?.length) {
                    new Notice("Enter a name!"); return;
                }
                if (!creature.modifier) creature.modifier = 0;
                if (creature.initiative <= 0 || creature.initiative == null || isNaN(creature.initiative)) {
                    creature.initiative = await plugin.getInitiativeValue(creature.modifier);
                }
                let existing = $adding.findIndex(([k]) => k != creature && equivalent(k, creature));
                if (existing > -1 && (await confirmWithModal(app, `This will merge ${creature.name} with ${$adding[existing][0].name}.`))) {
                    const index = $adding.findIndex(([k]) => k == creature);
                    $adding[existing][1] += $adding[index][1];
                    $adding.splice(index, 1);
                }
                $adding = $adding;
                $editing = null;
                creature = new Participant({});
            });
    };

    const cancelButton = (node: HTMLElement) => {
        new ExtraButtonComponent(node).setTooltip("Cancel").setIcon("reset")
            .onClick(() => { creature = new Participant({}); });
    };

    const diceButton = (node: HTMLElement) => {
        new ExtraButtonComponent(node).setIcon(DICE).setTooltip("Roll D20")
            .onClick(async () => {
                creature.initiative = await plugin.getInitiativeValue(creature.modifier);
            });
    };

    let nameInput: TextComponent;
    let displayNameInput: HTMLInputElement;

    const name = (node: HTMLElement) => {
        nameInput = new TextComponent(node)
            .setValue(creature.name)
            .onChange((v) => (creature.name = v));
    };

    onMount(() => {
        if (isEditing) setImmediate(() => displayNameInput.focus());
    });
</script>

<div class="initiative-tracker-editor">
    <div class="create-new">
        <div>
            <label for="add-name">Participant</label>
            <div use:name id="add-name" />
        </div>
        <div>
            <label for="add-display">Display Name</label>
            <input bind:value={creature.display} bind:this={displayNameInput}
                id="add-display" type="text" name="display" tabindex="0" />
        </div>
        <div>
            <label for="add-mod">D20 Bonus</label>
            <input bind:value={modifier} id="add-mod" type="text" name="add-mod" tabindex="0" />
        </div>
        <div>
            <label for="add-ac">Role Modifier (label)</label>
            <input bind:value={creature.ac} id="add-ac" name="ac" type="text" tabindex="0" />
        </div>
        <div class="initiative">
            <label for="add-init">D20 Roll</label>
            <input bind:value={creature.initiative} id="add-init" type="number" name="initiative" tabindex="0" />
            <div class="dice" use:diceButton />
        </div>
        <div>
            <label for="add-note">Character Sheet (path)</label>
            <input bind:value={creature.note} id="add-note" type="text" name="note" tabindex="0" />
        </div>
    </div>
    {#if !isEditing && !Platform.isMobile}
        <div class="context-buttons">
            <div use:cancelButton class="add-button cancel-button" />
            {#if $editing}
                <div class="add-button" use:editButton />
            {:else}
                <div class="add-button" use:saveButton />
            {/if}
        </div>
    {/if}
</div>

<style>
    .create-new > * { display: grid; grid-template-columns: 33% 66%; margin-bottom: 0.5rem; }
    .context-buttons { display: flex; justify-content: flex-end; align-items: center; grid-gap: 0.125rem; }
    .cancel-button { color: var(--text-faint); }
    .initiative { position: relative; }
    .initiative > .dice { position: absolute; right: 0.25rem; top: 50%; transform: translateY(-50%); }
</style>
