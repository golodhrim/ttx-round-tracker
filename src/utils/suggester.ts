import type { FuzzyMatch } from "obsidian";
import { FuzzyInputSuggest } from "obsidian-utilities";

import type { HomebrewCreature } from "src/types/participants";
import type { SRDMonster } from "src/types/participants";
import type { Participant } from "./participant";

export class SRDMonsterSuggestionModal extends FuzzyInputSuggest<
    HomebrewCreature | SRDMonster
> {
    renderNote(
        noteEL: HTMLElement,
        result: FuzzyMatch<HomebrewCreature | SRDMonster>
    ): void {
        noteEL.setText([result.item.source].flat().join(", "));
    }
    renderTitle(
        titleEl: HTMLElement,
        result: FuzzyMatch<HomebrewCreature | SRDMonster>
    ): void {
        this.renderMatches(titleEl, result.item.name, result.match.matches);
    }
    getItemText(item: HomebrewCreature | SRDMonster) {
        return item.name;
    }
}
export class ConditionSuggestionModal extends FuzzyInputSuggest<string> {
    renderNote(noteEL: HTMLElement, result: FuzzyMatch<string>): void {}
    renderTitle(titleEl: HTMLElement, result: FuzzyMatch<string>): void {
        this.renderMatches(titleEl, result.item, result.match.matches);
    }
    getItemText(item: string) {
        return item;
    }
}

export class PlayerSuggestionModal extends FuzzyInputSuggest<Participant> {
    renderNote(noteEL: HTMLElement, result: FuzzyMatch<Participant>): void {}
    renderTitle(titleEl: HTMLElement, result: FuzzyMatch<Participant>): void {
        this.renderMatches(titleEl, result.item.name, result.match.matches);
    }
    getItemText(item: Participant) {
        return item.name;
    }
}
