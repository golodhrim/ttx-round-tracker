import type { SRDCharacter } from "src/types/participants";
import { writable } from "svelte/store";
import { players } from "./players";
function createEncounter() {
    const store = writable<Map<SRDCharacter, number>>(new Map());
    const { subscribe, set, update } = store;
    return {
        players,
        subscribe,
        add: (item: SRDCharacter) =>
            update((monsters) => {
                monsters.set(item, (monsters.get(item) ?? 0) + 1);
                return monsters;
            }),
        remove: (item: SRDCharacter) =>
            update((monsters) => {
                let existing = monsters.get(item);
                if (!existing) return monsters;
                if (existing == 1) {
                    monsters.delete(item);
                }
                if (existing > 1) {
                    monsters.set(item, existing - 1);
                }
                return monsters; // this line is important to update the store value !!
            }),
        delete: (item: SRDCharacter) =>
            update((monsters) => {
                monsters.delete(item);
                return monsters;
            }),
        set: (item: SRDCharacter, count: number) =>
            update((monsters) => {
                monsters.set(item, count);
                return monsters;
            }),
        setMultiple: (creatures: [item: SRDCharacter, count: number][]) =>
            update((monsters) => {
                for (const [item, count] of creatures) {
                    monsters.set(item, count);
                }
                return monsters;
            }),
        empty: () => set(new Map()),
        update: (creature: SRDCharacter) =>
            update((monsters) => {
                monsters.set(creature, monsters.get(creature) ?? 1);
                return monsters;
            })
    };
}

export const encounter = createEncounter();
