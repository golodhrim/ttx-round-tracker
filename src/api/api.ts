import type { InitiativeViewState } from "src/tracker/view.types";
import type InitiativeTracker from "../main";
import { tracker } from "../tracker/stores/tracker";
import { type HomebrewParticipant } from "src/types/participants";
import { Participant } from "src/utils/participant";

declare module "obsidian" {
    interface Workspace {
        on(
            name: "initiative-tracker:should-save",
            callback: () => void
        ): EventRef;
        trigger(name: "initiative-tracker:should-save"): void;
        on(
            name: "initiative-tracker:save-state",
            callback: (state?: InitiativeViewState) => void
        ): EventRef;
        trigger(
            name: "initiative-tracker:save-state",
            state?: InitiativeViewState
        ): void;
        /** This event can be used to start an event by sending an object with a name, HP, AC, and initiative modifier at minimum. */
        on(
            name: "initiative-tracker:start-encounter",
            callback: (creatures: HomebrewParticipant[]) => void
        ): EventRef;
        trigger(
            name: "initiative-tracker:start-encounter",
            creatures: HomebrewParticipant[]
        ): void;
        on(
            name: "initiative-tracker:stop-viewing",
            callback: (creatures: HomebrewParticipant[]) => void
        ): EventRef;
        trigger(name: "initiative-tracker:stop-viewing"): void;
        on(name: "initiative-tracker:unloaded", callback: () => void): EventRef;
        trigger(name: "initiative-tracker:unloaded"): void;
    }
}

declare global {
    interface Window {
        InitiativeTracker?: API;
    }
}

export class API {
    #tracker = tracker;
    constructor(public plugin: InitiativeTracker) {
        (window["InitiativeTracker"] = this) &&
            this.plugin.register(() => delete window["InitiativeTracker"]);
    }

    addCreatures(
        creatures: HomebrewParticipant[],
        rollHP: boolean = this.plugin.data.rollHP
    ) {
        if (!creatures || !Array.isArray(creatures) || !creatures.length) {
            throw new Error("Creatures must be an array.");
        }
        this.#tracker.add(
            this.plugin,
            rollHP,
            ...creatures.map((c) => Participant.from(c))
        );
    }
    newEncounter(state?: InitiativeViewState) {
        if (state?.participants) {
            state.participants = state.participants.map((c) =>
                Participant.from(c).toJSON()
            );
        }
        this.#tracker.new(this.plugin, state);
    }
}
