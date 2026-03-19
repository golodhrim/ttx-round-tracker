import type { Condition } from "src/types/participants";
import type { HomebrewParticipant } from "src/types/participants";
import type { SRDCharacter } from "src/types/participants";
import type { ParticipantState } from "src/types/participants";
import { Conditions } from ".";
import { DEFAULT_UNDEFINED } from "./constants";
import type InitiativeTracker from "src/main";

export function getId() {
    return "ID_xyxyxyxyxyxy".replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0,
            v = c == "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

export class Participant {
    active: boolean;
    name: string;
    modifier: number | number[];
    hp: number;
    hit_dice?: string;
    rollHP?: boolean;
    temp: number;
    ac: number | string;
    current_ac: number | string;
    dirty_ac: boolean;
    note: string;
    enabled: boolean = true;
    hidden: boolean = false;
    max: number;
    current_max: number;
    level: number;
    player: boolean;
    status: Set<Condition> = new Set();
    marker: string;
    initiative: number;
    manualOrder: number;
    static: boolean = false;
    source: string | string[];
    id: string;
    xp: number;
    viewing: boolean = false;
    number = 0;
    display: string;
    friendly: boolean = false;
    "statblock-link": string;
    cr: string | number;
    path: string;
    setModifier(modifier: number[] | number) {
        if (modifier) {
            if (Array.isArray(modifier)) {
                this.modifier = [...modifier];
            }
            if (!isNaN(Number(modifier))) {
                this.modifier = Number(modifier);
            }
        }
        this.modifier = this.modifier ?? 0;
    }
    addCondition(condition: Condition) {
        if (![...this.status].find(cond => cond.name === condition.name && cond.amount === condition.amount)) {
            this.status.add(condition);
        }
    }
    removeCondition(condition: Condition) {
        this.status = new Set(
            [...this.status].filter((s) => s.id != condition.id)
        );    }
    constructor(public participantData: HomebrewParticipant, initiative: number = 0) {
        this.name = participantData.name;
        this.display = participantData.display;
        this.initiative =
            "initiative" in participantData
                ? (participantData as Participant).initiative
                : Number(initiative ?? 0);
        this.static = participantData.static ?? false;
        this.setModifier(participantData.modifier);
        this.current_ac = this.ac = participantData.ac ?? undefined;
        this.dirty_ac = false;
        this.max = this.current_max = participantData.hp ? Number(participantData.hp) : 0;
        this.note = participantData.note;
        this.level = participantData.level;
        this.player = participantData.player;

        this.rollHP = participantData.rollHP;

        this.marker = participantData.marker;

        this.hp = this.max;
        this.temp = 0;
        this.source = participantData.source;

        this.friendly = participantData.friendly ?? this.friendly;

        this.active = participantData.active;

        this.hidden = participantData.hidden ?? false;

        this.note = participantData.note;
        this.path = participantData.path;

        this.xp = participantData.xp;

        this.cr = participantData.cr;
        this.id = participantData.id ?? getId();
        if ("statblock-link" in participantData) {
            this["statblock-link"] = (participantData as any)[
                "statblock-link"
            ] as string;
        }
        if ("hit_dice" in participantData && typeof participantData.hit_dice == "string") {
            this.hit_dice = participantData.hit_dice;
        }
    }
    get hpDisplay() {
        if (this.current_max) {
            const tempMods =
                this.temp > 0
                    ? `aria-label="Temp HP: ${this.temp}" style="font-weight:bold"`
                    : "";
            return `
                <span ${tempMods}>${this.hp + this.temp}</span><span>/${
                this.current_max
            }</span>
            `;
        }
        return DEFAULT_UNDEFINED;
    }

    getName() {
        let name = [this.display ?? this.name];
        /* if (this.display) {
            return this.display;
        } */
        if (this.number > 0) {
            name.push(`${this.number}`);
        }
        return name.join(" ");
    }
    getStatblockLink(): string {
        if ("statblock-link" in this) {
            const value = this["statblock-link"];
            return value.startsWith("#")
                ? `[${this.name}](${this.note}${value})`
                : value;
        }
    }

    *[Symbol.iterator]() {
        yield this.name;
        yield this.initiative;
        yield this.static;
        yield this.modifier;
        yield this.max;
        yield this.ac;
        yield this.note;
        yield this.path;
        yield this.id;
        yield this.marker;
        yield this.xp;
        yield this.hidden;
        yield this.hit_dice;
        yield this.current_ac;
        yield this.rollHP;
    }

    static new(participant: Participant) {
        return new Participant(
            {
                ...participant,
                id: getId()
            },
            participant.initiative
        );
    }

    static from(participantData: HomebrewParticipant | SRDCharacter) {
        const modifier =
            "modifier" in participantData
                ? participantData.modifier
                : Math.floor(
                      (("stats" in participantData && participantData.stats.length > 1
                          ? participantData.stats[1]
                          : 10) -
                          10) /
                          2
                  );
        return new Participant({
            ...participantData,
            modifier: modifier
        });
    }

    update(participantData: HomebrewParticipant) {
        this.name = participantData.name;

        this.setModifier(participantData.modifier);

        this.current_max = this.max = participantData.hp ? Number(participantData.hp) : 0;

        if (this.hp > this.max) this.hp = this.max;

        this.current_ac = this.ac = participantData.ac ?? undefined;
        this.note = participantData.note;
        this.level = participantData.level;
        this.player = participantData.player;
        this["statblock-link"] = participantData["statblock-link"];

        this.marker = participantData.marker;
        this.source = participantData.source;
    }

    toProperties() {
        return { ...this };
    }

    toJSON(): ParticipantState {
        return {
            name: this.name,
            display: this.display,
            initiative: this.initiative,
            static: this.static,
            modifier: this.modifier,
            hp: this.max,
            currentMaxHP: this.current_max,
            cr: this.cr,
            ac: this.ac,
            currentAC: this.current_ac,
            note: this.note,
            path: this.path,
            id: this.id,
            marker: this.marker,
            currentHP: this.hp,
            tempHP: this.temp,
            status: Array.from(this.status).map((c) => c.name),
            enabled: this.enabled,
            level: this.level,
            player: this.player,
            xp: this.xp,
            active: this.active,
            hidden: this.hidden,
            friendly: this.friendly,
            "statblock-link": this["statblock-link"],
            hit_dice: this.hit_dice,
            rollHP: this.rollHP
        };
    }

    static fromJSON(state: ParticipantState, plugin: InitiativeTracker) {
        let participant: Participant;
        if (state.player) {
            participant =
                plugin.getPlayerByName(state.name) ??
                new Participant(state, state.initiative);
            participant.initiative = state.initiative;
        } else {
            participant = new Participant(state, state.initiative);
        }
        participant.enabled = state.enabled;

        participant.temp = state.tempHP ? state.tempHP : 0;
        participant.current_max = state.currentMaxHP;
        participant.hp = state.currentHP;
        participant.current_ac = state.currentAC;
        let statuses: Condition[] = [];
        for (const status of state.status) {
            const existing = Conditions.find(({ name }) => status == name);
            if (existing) {
                statuses.push(existing);
            } else {
                statuses.push({
                    name: status,
                    description: null,
                    id: getId()
                });
            }
        }
        participant.status = new Set(statuses);
        participant.active = state.active;
        return participant;
    }
}

