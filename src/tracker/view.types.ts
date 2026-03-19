import type { CreatureState, HomebrewCreature } from "src/types/participants";

export interface InitiativeViewState {
    participants: CreatureState[];
    state: boolean;
    name: string;
    round: number;
    logFile: string;
    roll?: boolean;
    rollHP?: boolean;
    timestamp?: number;
}export interface InitiativeViewState {
    participants: CreatureState[];
    state: boolean;
    name: string;
    round: number;
    logFile: string;
    newLog?: boolean;
    roll?: boolean;
    rollHP?: boolean;
    timestamp?: number;
}

