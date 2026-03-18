// src/console/stores/round.ts
import { writable } from "svelte/store";
import type { RoundState, ActionFile, RollResult } from "../console.types";

function createRoundStore() {
    const initial: RoundState = {
        round: 1,
        phase: "declare",
        declarations: {},
        dcs: {},
        results: {},
        roundCloseText: ""
    };
    const store = writable<RoundState>({ ...initial });

    function reset(round: number) {
        store.set({ ...initial, round });
    }

    function setDeclaration(playerName: string, action: ActionFile) {
        store.update((s) => ({
            ...s,
            declarations: { ...s.declarations, [playerName]: action }
        }));
    }

    function setDC(playerName: string, dc: number) {
        store.update((s) => ({
            ...s,
            dcs: { ...s.dcs, [playerName]: dc }
        }));
    }

    function setResult(playerName: string, result: RollResult) {
        store.update((s) => ({
            ...s,
            results: { ...s.results, [playerName]: result }
        }));
    }

    function advancePhase(
        phase: RoundState["phase"]
    ) {
        store.update((s) => ({ ...s, phase }));
    }

    function setRoundClose(text: string) {
        store.update((s) => ({ ...s, roundCloseText: text }));
    }

    return {
        subscribe: store.subscribe,
        reset,
        setDeclaration,
        setDC,
        setResult,
        advancePhase,
        setRoundClose
    };
}

export const roundStore = createRoundStore();
