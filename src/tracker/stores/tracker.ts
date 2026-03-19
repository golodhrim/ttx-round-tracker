import { Participant, getId } from "src/utils/participant";
import type InitiativeTracker from "../../main";
import {
    derived,
    get,
    type Updater,
    type Writable,
    writable
} from "svelte/store";
import { equivalent } from "../../encounter";
import { Events, Platform, TFile } from "obsidian";
import type { UpdateLogMessage } from "src/logger/logger.types";
import type { Condition } from "src/types/participants";
import type { InitiativeTrackerData } from "src/settings/settings.types";
import type { InitiativeViewState } from "../view.types";
import {
    OVERFLOW_TYPE,
    RESOLVE_TIES,
    RollPlayerInitiativeBehavior,
    getRpgSystem
} from "src/utils";
import type Logger from "../../logger/logger";
import type {
    DifficultyLevel,
    DifficultyThreshold
} from "src/utils/rpg-system";
import type { StackRoller } from "@javalent/dice-roller";

type HPUpdate = {
    saved: boolean;
    resist: boolean;
    customMod: "2" | "1";
};
type ParticipantUpdate = {
    hp?: number;
    ac?: number | string;
    current_ac?: number | string;
    initiative?: number;
    name?: string;
    marker?: string;
    temp?: number;
    max?: number;
    status?: Condition[];
    remove_status?: Condition[];
    hidden?: boolean;
    enabled?: boolean;
    //this is so dirty
    set_hp?: number;
    set_max_hp?: number;
};
type ParticipantUpdates = { participant: Participant; change: ParticipantUpdate };
const modifier = Platform.isMacOS ? "Meta" : "Control";
function createTracker() {
    const participants = writable<Participant[]>([]);
    const updating = writable<Map<Participant, HPUpdate>>(new Map());
    const updateTarget = writable<"ac" | "hp">();
    const { subscribe, set, update } = participants;

    const $logFile = writable<TFile | null>();

    let _logger: Logger;

    const $round = writable<number>(1);
    const $state = writable<boolean>(false);
    const setState = (state: boolean) => {
        $state.set(state);
        if (state) {
            if (!_logger?.logging) {
                _logger
                    ?.new({
                        name: get($name)!,
                        players: current_order.filter((c) => c.player),
                        participants: current_order.filter((c) => !c.player),
                        round: get($round)
                    })
                    .then(() => {
                        $logFile.set(_logger.getFile());
                    });
            } else {
                _logger?.log(`Combat re-started`);
            }
        } else {
            _logger?.log("Combat stopped");
        }
        updateAndSave((participants) => {
            if (participants.length && !participants.find((c) => c.active)) {
                current_order[0].active = true;
            }
            return participants;
        });
    };
    const $name = writable<string | null>();
    const $party = writable<string | null>();

    const data = writable<InitiativeTrackerData>();
    const descending = derived(data, (data) => {
        return data.descending;
    });
    let _settings: InitiativeTrackerData | null;
    
    const condensed = derived(participants, (values) => {
        if (_settings?.condense) {
            values.forEach((creature, _, arr) => {
                const equiv = arr.filter((c) => equivalent(c, creature));
                const initiatives = equiv.map((i) => i.initiative);
                const initiative =
                    initiatives[Math.floor(Math.random() * initiatives.length)];
                equiv.forEach((eq) => {
                    if (eq.static) return;
                    eq.initiative = initiative;
                });
            });
        }
        return values;
    });

    let current_order: Participant[] = [];
    const ordered = derived([condensed, data], ([values, data]) => {
        const sort = [...values];
        sort.sort((a, b) => {
            /* Order participants in this order:
               1. By initiative
               2. By manual order (drag & drop)
               3. According to the resolveTies setting */
            if (a.initiative != b.initiative) {
                return data.descending
                ? b.initiative - a.initiative
                : a.initiative - b.initiative;
            }
            
            if (
                a.manualOrder !== null && a.manualOrder !== undefined && 
                b.manualOrder !== null && b.manualOrder !== undefined && 
                a.manualOrder !== b.manualOrder
            ) {
                const aOrder = a.manualOrder || 0;
                const bOrder = b.manualOrder || 0;
                return aOrder - bOrder;
            }
            
            switch (_settings.resolveTies) {
                case RESOLVE_TIES.random:
                    return Math.random() < 0.5 ? 1 : -1;
                case RESOLVE_TIES.playerFirst:
                case RESOLVE_TIES.npcFirst:
                    const aPlayer = a.player ? 1 : 0;
                    const bPlayer = b.player ? 1 : 0;
                    if (_settings.resolveTies == RESOLVE_TIES.playerFirst) {
                        return bPlayer - aPlayer
                    } else {
                        return aPlayer - bPlayer
                    }
            }
            
        });
        current_order = sort;
        return sort;
    });

    const logNewInitiative = (participant: Participant) => {
        _logger?.log(
            `${participant.getName()} initiative changed to ${participant.initiative}`
        );
    };

    const performParticipantUpdate = (
        participants: Participant[],
        ...updates: ParticipantUpdates[]
    ) => {
        for (const { participant, change } of updates) {
            if (change.initiative) {
                participant.initiative = Number(change.initiative);
                logNewInitiative(participant);
            }
            if (change.name) {
                participant.name = change.name;
                participant.number = 0;
            }
            if (change.hp) {
                // Reduce temp HP first
                change.hp = Number(change.hp);
                if (change.hp < 0 && participant.temp > 0) {
                    const remaining = participant.temp + change.hp;
                    participant.temp = Math.max(0, remaining);
                    change.hp = Math.min(0, remaining);
                }
                // Clamp HP at 0 if clamp is enabled in settings
                if (_settings.clamp && participant.hp + change.hp < 0) {
                    change.hp = -participant.hp;
                }
                // Handle overflow healing according to settings
                if (
                    change.hp > 0 &&
                    change.hp + participant.hp > participant.current_max
                ) {
                    switch (_settings.hpOverflow) {
                        case OVERFLOW_TYPE.ignore:
                            change.hp = Math.max(
                                participant.current_max - participant.hp,
                                0
                            );
                            break;
                        case OVERFLOW_TYPE.temp:
                            // Gives temp a value, such that it will be set later
                            change.temp =
                                change.hp -
                                Math.min(participant.current_max - participant.hp, 0);
                            change.hp -= change.temp;
                            break;
                        case OVERFLOW_TYPE.current:
                            break;
                    }
                }
                participant.hp += change.hp;
                if (_settings.autoStatus && participant.hp <= 0) {
                    const unc = _settings.statuses.find(
                        (s) => s.id == _settings.unconsciousId
                    );
                    if (unc) participant.addCondition(unc);
                }
            }
            if (change.max) {
                participant.current_max = Math.max(
                    0,
                    participant.current_max + change.max
                );
                if (
                    participant.hp >= participant.current_max &&
                    _settings.hpOverflow !== OVERFLOW_TYPE.current
                ) {
                    participant.hp = participant.current_max;
                }
            }
            if (change.set_hp) {
                participant.hp = change.set_hp;
            }
            if (change.set_max_hp) {
                participant.current_max = participant.max = change.set_max_hp;
            }
            if (change.ac) {
                participant.current_ac = participant.ac = change.ac;
            }
            if (change.temp) {
                let baseline = 0;
                if (_settings.additiveTemp) {
                    baseline = participant.temp;
                }
                if (change.temp > 0) {
                    participant.temp = Math.max(
                        participant.temp,
                        baseline + change.temp
                    );
                } else {
                    participant.temp = Math.max(0, participant.temp + change.temp);
                }
            }
            if (change.marker) {
                participant.marker = change.marker;
            }
            if (change.status?.length) {
                for (const status of change.status) {
                    participant.addCondition(status);
                }
            }
            if (change.remove_status?.length) {
                for (const status of change.remove_status) {
                    participant.removeCondition(status);
                }
            }
            if ("hidden" in change) {
                participant.hidden = change.hidden!;
                _logger.log(
                    `${participant.getName()} ${
                        participant.hidden ? "hidden" : "revealed"
                    }`
                );
            }
            if ("enabled" in change) {
                participant.enabled = change.enabled!;
                _logger.log(
                    `${participant.getName()} ${
                        participant.enabled ? "enabled" : "disabled"
                    }`
                );
            }
            if (!participants.includes(participant)) {
                participants.push(participant);
            }
        }
        return participants;
    };
    const updateParticipants = (...updates: ParticipantUpdates[]) =>
        updateAndSave((participants) => {
            return performParticipantUpdate(participants, ...updates);
        });

    const getEncounterState = (): InitiativeViewState => {
        return {
            participants: get(participants).map((c) => c.toJSON()),
            state: get($state),
            name: get($name)!,
            round: get($round),
            logFile: _logger?.getLogFile() ?? null,
            rollHP: false
        };
    };

    const trySave = () => {
        app.workspace.trigger(
            "initiative-tracker:save-state",
            getEncounterState()
        );
    };

    function updateAndSave(updater: Updater<Participant[]>): void {
        update(updater);
        trySave();
    }

    const setNumbers = (list: Participant[]) => {
        for (let i = 0; i < list.length; i++) {
            const participant = list[i];
            if (
                participant.player ||
                list.filter((c) => c.name == participant.name).length == 1
            ) {
                continue;
            }
            if (participant.number > 0) continue;
            const prior = list
                .filter((c) =>
                    c.display
                        ? c.display == participant.display
                        : c.name == participant.name
                )
                .map((c) => c.number);

            participant.number = prior?.length ? Math.max(...prior) + 1 : 1;
        }
    };

    function rollIntiative(
        plugin: InitiativeTracker,
                participants: Participant[]
    ): Participant[] {
        for (let participant of participants) {
            if (participant.static && participant.initiative) continue;
            participant.active = false;
            if (
                participant.player &&
                plugin.data.rollPlayerInitiatives ==
                    RollPlayerInitiativeBehavior.Never
            )
                continue;
            if (
                participant.player &&
                plugin.data.rollPlayerInitiatives ==
                    RollPlayerInitiativeBehavior.SetToZero
            ) {
                participant.initiative = 0;
            } else {
                participant.initiative = plugin.getInitiativeValue(
                    participant.modifier
                );
            }
            participant.manualOrder = null;
        }
        return participants;
    }

    return {
        subscribe,
        set,

        data,
        setData: (settings: InitiativeTrackerData) => {
            data.set(settings);
            _settings = settings;
        },

        getLogger: () => _logger,

        setLogger: (logger: Logger) => {
            _logger = logger;
        },

        updating,
        updateTarget,
        updateParticipants,
        updateParticipantByName: (name: string, change: ParticipantUpdate) =>
            updateAndSave((participants) => {
                const participant = participants.find((c) => c.name == name);
                if (participant) {
                    if (!isNaN(Number(change.hp))) {
                        participant.hp = change.hp;
                    }
                    if (change.max) {
                        participant.current_max = Math.max(
                            0,
                            participant.current_max + change.max
                        );
                        if (
                            participant.hp >= participant.current_max &&
                            _settings.hpOverflow !== OVERFLOW_TYPE.current
                        ) {
                            participant.hp = participant.current_max;
                        }
                    }
                    if (change.temp) {
                        let baseline = 0;
                        if (_settings.additiveTemp) {
                            baseline = participant.temp;
                        }
                        if (change.temp > 0) {
                            participant.temp = Math.max(
                                participant.temp,
                                baseline + change.temp
                            );
                        } else {
                            participant.temp = Math.max(
                                0,
                                participant.temp + change.temp
                            );
                        }
                    }
                    if (change.marker) {
                        participant.marker = change.marker;
                    }
                    if (
                        typeof change.ac == "string" ||
                        !isNaN(Number(change.ac))
                    ) {
                        participant.ac = participant.current_ac = change.ac;
                    }
                    if (
                        typeof change.current_ac == "string" ||
                        !isNaN(Number(change.current_ac))
                    ) {
                        participant.current_ac = change.ac;
                    }
                    if (!isNaN(Number(change.initiative))) {
                        participant.initiative = change.initiative;
                    }
                    if (typeof change.name == "string") {
                        participant.name = change.name;
                    }
                    if ("hidden" in change) {
                        participant.hidden = change.hidden;
                    }
                    if ("enabled" in change) {
                        participant.enabled = change.enabled;
                    }
                    if (Array.isArray(change.status) && change.status?.length) {
                        for (const status of change.status) {
                            if (typeof status == "string") {
                                let cond = _settings.statuses.find(
                                    (c) => c.name == status
                                ) ?? {
                                    name: status,
                                    description: "",
                                    id: getId()
                                };
                                participant.addCondition(cond);
                            } else if (
                                typeof status == "object" &&
                                status.name?.length
                            ) {
                                participant.addCondition(status as Condition);
                            }
                        }
                    }
                }

                return participants;
            }),

        players: derived(ordered, (participants) =>
            participants.filter((c) => c.player)
        ),

        setUpdate: (participant: Participant, evt: MouseEvent) =>
            updating.update((updatingMap) => {
                if (updatingMap.has(participant)) {
                    updatingMap.delete(participant);
                } else {
                    updatingMap.set(participant, {
                        saved: evt.getModifierState("Shift"),
                        resist: evt.getModifierState(modifier),
                        customMod: evt.getModifierState("Alt") ? "2" : "1"
                    });
                }
                return updatingMap;
            }),
        doUpdate: (
            toAddString: string,
            statuses: Condition[],
            ac: string,
            removeStatuses: Condition[] = []
        ) =>
            updating.update((updatingCreatures) => {
                const messages: UpdateLogMessage[] = [];
                const updates: ParticipantUpdates[] = [];

                updatingCreatures.forEach((entry, participant) => {
                    const roundHalf = !toAddString.includes(".");
                    const change: ParticipantUpdate = {};
                    const modifier =
                        (entry.saved ? 0.5 : 1) *
                        (entry.resist ? 0.5 : 1) *
                        Number(entry.customMod);
                    const name = [participant.name];
                    if (participant.number > 0) {
                        name.push(`${participant.number}`);
                    }
                    const message: UpdateLogMessage = {
                        name: name.join(" "),
                        hp: null,
                        temp: false,
                        max: false,
                        status: null,
                        remove_status: null,
                        saved: false,
                        unc: false,
                        ac: null,
                        ac_add: false
                    };

                    if (toAddString.charAt(0) == "t") {
                        let toAdd = Number(toAddString.slice(1));
                        message.hp = toAdd;
                        message.temp = true;
                        change.temp = toAdd;
                    } else {
                        const maxHpDamage = toAddString.charAt(0) === "m";
                        let toAdd = Number(toAddString.slice(+maxHpDamage));
                        toAdd =
                            -1 *
                            Math.sign(toAdd) *
                            Math.max(Math.abs(toAdd) * modifier, 1);
                        toAdd = roundHalf ? Math.trunc(toAdd) : toAdd;
                        message.hp = toAdd;
                        if (maxHpDamage) {
                            message.max = true;
                            change.max = toAdd;
                        }
                        change.hp = toAdd;
                        if (participant.hp <= 0) {
                            message.unc = true;
                        }
                    }
                    if (statuses.length) {
                        message.status = statuses.map((s) => s.name);
                        if (!entry.saved) {
                            change.status = statuses;
                        } else {
                            message.saved = true;
                        }
                    }
                    if (removeStatuses.length) {
                        change.remove_status = removeStatuses;
                    }
                    if (ac) {
                        if (ac.charAt(0) == "+" || ac.charAt(0) == "-") {
                            const current_ac = parseInt(
                                String(participant.current_ac)
                            );
                            if (isNaN(current_ac)) {
                                participant.current_ac = participant.current_ac + ac;
                            } else {
                                participant.current_ac = current_ac + parseInt(ac);
                            }
                            message.ac_add = true;
                        } else {
                            participant.current_ac = ac.slice(
                                Number(ac.charAt(0) == "\\")
                            );
                        }
                        message.ac = ac.slice(Number(ac.charAt(0) == "\\"));
                    }
                    messages.push(message);
                    updates.push({ participant, change });
                });
                _logger?.logUpdate(messages);
                updateParticipants(...updates);
                updatingCreatures.clear();
                return updatingCreatures;
            }),
        clearUpdate: () =>
            updating.update((updates) => {
                updates.clear();
                return updates;
            }),

        round: $round,

        name: $name,

        sort: descending,

        party: $party,
        setParty: (party: string, plugin: InitiativeTracker) =>
            updateAndSave((participants) => {
                const players = plugin.getPlayersForParty(party);
                $party.set(party);
                participants = [...participants.filter((c) => !c.player), ...players];
                return participants;
            }),

        state: $state,
        getState: () => get($state),
        toggleState: () => {
            setState(!get($state));
        },
        setState,

        goToNext: () =>
            updateAndSave((participants) => {
                const current = current_order.findIndex((c) => {
                    return c.active;
                });
                if (current == -1) {
                    current_order[0].active = true;
                } else {
                    let next;
                    let nextIndex = current;
                    do {
                        nextIndex =
                            (((nextIndex + 1) % current_order.length) +
                                current_order.length) %
                            current_order.length;
                        next = current_order[nextIndex];
                        if (nextIndex == current) {
                            break;
                        }
                    } while (!next.enabled);

                    if (next) {
                        current_order[current].active = false;
                        if (nextIndex < current) {
                            const round = get($round) + 1;
                            $round.set(round);

                            for (const participant of participants) {
                                participant.status = new Set(
                                    [...participant.status].filter(
                                        (s) => !s.resetOnRound
                                    )
                                );
                            }

                            _logger?.log("###", `Round ${round}`);
                        }
                        _logger?.log("#####", `${next.getName()}'s turn`);
                        next.active = true;
                    }
                }
                return participants;
            }),
        goToPrevious: () =>
            updateAndSave((participants) => {
                const current = current_order.findIndex((c) => {
                    return c.active;
                });
                if (current == 0 && get($round) == 1) return participants;

                if (current == -1) {
                    current_order[0].active = true;
                } else {
                    let prev;
                    let prevIndex = current;
                    do {
                        prevIndex =
                            (((prevIndex - 1) % current_order.length) +
                                current_order.length) %
                            current_order.length;
                        prev = current_order[prevIndex];
                        if (prevIndex == current) {
                            break;
                        }
                    } while (!prev.enabled);

                    if (prev) {
                        current_order[current].active = false;
                        if (prevIndex > current) {
                            const round = get($round) - 1;
                            $round.set(round);
                            for (const participant of participants) {
                                participant.status = new Set(
                                    [...participant.status].filter(
                                        (s) => !s.resetOnRound
                                    )
                                );
                            }
                            _logger?.log("###", `Round ${round}`);
                        }
                        _logger?.log("#####", `${prev.getName()}'s turn`);
                        prev.active = true;
                    }
                }
                return participants;
            }),

        ordered,

        add: async (
            plugin: InitiativeTracker,
            roll: boolean = plugin.data.rollHP,
            ...items: Participant[]
        ) =>
            updateAndSave((participants) => {
                if (plugin.canUseDiceRoller && roll) {
                    setParticipantHP(items, plugin, roll);
                }

                participants.push(...items);
                const toRoll: Participant[] = [];
                if (!_settings.condense) {
                    toRoll.push(...items);
                } else {
                    for (const participant of items) {
                        const existing = current_order.find((c) =>
                            equivalent(c, participant)
                        );
                        if (existing) {
                            participant.initiative = existing.initiative;
                        } else {
                            toRoll.push(participant);
                        }
                    }
                }
                rollIntiative(plugin, toRoll);
                _logger?.log(
                    _logger?.join(items.map((c) => c.name)),
                    "added to the combat."
                );
                setNumbers(participants);
                return participants;
            }),
        remove: (...items: Participant[]) =>
            updateAndSave((participants) => {
                participants = participants.filter((m) => !items.includes(m));

                _logger?.log(
                    _logger?.join(items.map((c) => c.name)),
                    "removed from the combat."
                );
                return participants;
            }),
        replace: (old: Participant, replacer: Participant) => {
            updateAndSave((participants) => {
                participants.splice(participants.indexOf(old), 1, replacer);
                setNumbers(participants);
                return participants;
            });
        },
        update: () => update((c) => c),
        updateAndSave: () => updateAndSave((c) => c),
        roll: (plugin: InitiativeTracker) =>
            updateAndSave((participants) => {
                rollIntiative(plugin, participants);
                return participants;
            }),
        new: (plugin: InitiativeTracker, state?: InitiativeViewState) =>
            updateAndSave((participants) => {
                $round.set(state?.round ?? 1);
                $state.set(state?.state ?? false);
                $name.set(state?.name ?? null);

                if (!state?.participants) {
                    /**
                     * New encounter button was clicked, only maintain the players.
                     */
                    participants = participants.filter((c) => c.player);
                } else {
                    /**
                     * Encounter is being started. Keep any pre-existing players that are incoming.
                     */
                    const tempCreatureArray: Participant[] = [];

                    const party = get($party);
                    const players = new Map(
                        [
                            ...(party ? plugin.getPlayersForParty(party) : []),
                            ...participants.filter((p) => p.player)
                        ].map((c) => [c.id, c])
                    ).values();
                    for (const participant of state.participants) {
                        /* const ; */
                        let existingPlayer: Participant | null = null;
                        if (
                            participant.player &&
                            (existingPlayer = participants.find(
                                (c) => c.player && c.id === participant.id
                            )) &&
                            existingPlayer != null
                        ) {
                            tempCreatureArray.push(existingPlayer);
                        } else {
                            tempCreatureArray.push(
                                Participant.fromJSON(participant, plugin)
                            );
                        }
                    }
                    for (const player of players) {
                        if (
                            !tempCreatureArray.find(
                                (p) => p.player && p.id == player.id
                            )
                        ) {
                            tempCreatureArray.push(player);
                        }
                    }
                    participants = tempCreatureArray;
                }
                if (!state || state?.roll) {
                    rollIntiative(plugin, participants);
                }
                setNumbers(participants);
                if (
                    plugin.canUseDiceRoller &&
                    (state?.rollHP ?? plugin.data.rollHP)
                ) {
                    setParticipantHP(participants, plugin);
                }

                if (state?.logFile) {
                    _logger?.new(state.logFile).then(() => {
                        $logFile.set(_logger.getFile());
                    });
                }
                if ((!state && _logger) || state?.newLog) {
                    _logger.logging = false;
                    $logFile.set(null);
                }
                return participants;
            }),
        reset: () =>
            updateAndSave((participants) => {
                for (let participant of participants) {
                    participant.current_ac = participant.ac;
                    participant.hp = participant.current_max = participant.max;
                    participant.enabled = true;
                    participant.status.clear();
                }
                _logger?.log("Encounter HP & Statuses reset");
                return participants;
            }),

        getOrderedParticipants: () => get(ordered),
        logUpdate: (messages: UpdateLogMessage[]) => {
            const toLog: string[] = [];
            for (const message of messages) {
                const perCreature: string[] = [];
                if (message.hp) {
                    if (message.temp) {
                        perCreature.push(
                            `${
                                message.name
                            } gained ${message.hp.toString()} temporary HP`
                        );
                    } else if (message.max) {
                        if (message.hp < 0) {
                            perCreature.push(
                                `${message.name} took ${(
                                    -1 * message.hp
                                ).toString()} max HP damage${
                                    message.unc ? " and died" : ""
                                }`
                            );
                        } else {
                            perCreature.push(
                                `${message.name} gained ${(
                                    -1 * message.hp
                                ).toString()} max HP`
                            );
                        }
                    } else if (message.hp < 0) {
                        perCreature.push(
                            `${message.name} took ${(
                                -1 * message.hp
                            ).toString()} damage${
                                message.unc
                                    ? " and was knocked unconscious"
                                    : ""
                            }`
                        );
                    } else if (message.hp > 0) {
                        perCreature.push(
                            `${
                                message.name
                            } was healed for ${message.hp.toString()} HP`
                        );
                    }
                }
                if (message.status) {
                    if (perCreature.length) {
                        perCreature.push("and");
                    } else {
                        perCreature.push(message.name);
                    }
                    if (message.saved) {
                        perCreature.push(`saved against ${message.status}`);
                    } else {
                        perCreature.push(`took ${message.status} status`);
                    }
                }
                toLog.push(perCreature.join(" "));
            }
            _logger?.log(`${toLog.join(". ")}.`);
        },
        logNewInitiative,
        logFile: $logFile,

        getEncounterState,

        updateState: () => update((c) => c),

        difficulty: (plugin: InitiativeTracker) =>
            derived([participants, data], ([values]) => {
                const players: number[] = [];
                const participantMap = new Map<Participant, number>();
                const rpgSystem = getRpgSystem(plugin);

                for (const participant of values) {
                    if (!participant.enabled) continue;
                    if (participant.friendly) continue;
                    if (participant.player && participant.level) {
                        players.push(participant.level);
                        continue;
                    }
                    const stats = {
                        name: participant.name,
                        display: participant.display,
                        ac: participant.ac,
                        hp: participant.hp,
                        modifier: participant.modifier,
                        xp: participant.xp,
                        hidden: participant.hidden
                    };
                    const existing = [...participantMap].find(([c]) =>
                        equivalent(c, stats)
                    );
                    if (!existing) {
                        participantMap.set(participant, 1);
                        continue;
                    }
                    participantMap.set(existing[0], existing[1] + 1);
                }
                return {
                    difficulty: rpgSystem.getEncounterDifficulty(
                        participantMap,
                        players
                    ),
                    thresholds: rpgSystem.getDifficultyThresholds(players),
                    labels: rpgSystem.systemDifficulties
                };
            })
    };
}

export const tracker = createTracker();

function setParticipantHP(
    participants: Participant[],
    plugin: InitiativeTracker,
    rollHP = false
) {
    for (const participant of participants) {
        if (!participant.rollHP && !rollHP) continue;
        if (!participant.hit_dice?.length) continue;
        let roller = plugin.getRoller(participant.hit_dice);
        if (!roller) continue;
        participant.hp = participant.max = participant.current_max = roller.rollSync();
    }
}

/* export const tracker = new Tracker(); */
//TODO
class Tracker {
    #bus = new Events();

    #data: InitiativeTrackerData;
    #initiativeCallback: (modifier: number) => number;
    #initialized = false;
    /**
     * Initialize the tracker. The main plugin should be
     * the only thing to call this.
     */
    public initialize(
        data: InitiativeTrackerData,
        logger: Logger,
        initiativeCallback: (modifier: number) => number
    ) {
        this.#data = data;
        this.#initiativeCallback = initiativeCallback;
        this.#logger = logger;
        this.#initialized = true;
        this.#bus.trigger("initialized");
    }
    async isInitialized(): Promise<void> {
        return new Promise((resolve) => {
            if (this.#initialized) resolve();
            this.#bus.on("initialized", () => resolve());
        });
    }

    /** All participants in the encounter. Includes players. */
    #participants = writable<Participant[]>([]);
    /** All participants, ordered by initiative. */
    ordered = derived(this.#participants, (values) => {
        const sort = [...values];
        sort.sort((a, b) => {
            return this.#data.descending
                ? b.initiative - a.initiative
                : a.initiative - b.initiative;
        });
        this.#current_order = sort;
        return sort;
    });
    /** Static, non-store list. Populated during the order store update. */
    #current_order: Participant[] = [];
    /** Just players. */
    #players = derived(this.#participants, (participants) =>
        participants.filter((c) => c.player)
    );
    /** Just combatants. */
    #combatants = derived(this.#participants, (participants) =>
        participants.filter((c) => !c.player)
    );
    /** Enemies. */
    #enemies = derived(this.#combatants, (combatants) =>
        combatants.filter((c) => !c.friendly)
    );
    /** Allies */
    #allies = derived(this.#combatants, (combatants) =>
        combatants.filter((c) => c.friendly)
    );

    /** Encounter state. */
    round = writable(1);
    active = writable(false);
    getState() {
        return get(this.active);
    }
    setState(state: boolean) {
        this.active.set(state);
        if (state) {
            if (!this.#logger.logging) {
                this.#logger.new({
                    name: get(this.name)!,
                    players: this.#current_order.filter((c) => c.player),
                    participants: this.#current_order.filter((c) => !c.player),
                    round: get(this.round)
                });
            } else {
                this.tryLog(`Combat re-started`);
            }
        } else {
            this.tryLog("Combat stopped");
        }
        this.#updateAndSave((participants) => {
            if (participants.length && !participants.find((c) => c.active)) {
                this.#current_order[0].active = true;
            }
            return participants;
        });
    }
    name = writable<string | null>();
    party = writable<string | null>();
    getEncounterState(): InitiativeViewState {
        return {
            participants: get(this.#participants).map((c) => c.toJSON()),
            state: get(this.active),
            name: get(this.name)!,
            round: get(this.round),
            logFile: this.#logger?.getLogFile() ?? null,
            rollHP: false
        };
    }
    /**
     * The svelte store contract.
     * Expose the participant store, so this class can be
     * used directly as the participant store in svelte files.
     */
    subscribe = this.#participants.subscribe;
    set = this.#participants.set;
    update = this.#participants.update;
    #updateAndSave(updater: Updater<Participant[]>) {
        this.update(updater);
        app.workspace.trigger(
            "initiative-tracker:save-state",
            this.getEncounterState()
        );
    }

    new(state: InitiativeViewState) {}
    add(roll: boolean = this.#data.rollHP, ...items: Participant[]) {}
    remove(...items: Participant[]) {}

    /**
     * Logging
     */
    #logger: Logger;
    tryLog(...msg: string[]) {
        if (this.#logger) {
            this.#logger.log(...msg);
        }
    }

    /** Participant updates */
    updating = writable<Map<Participant, HPUpdate>>(new Map());
    updateTarget = writable<"ac" | "hp">();
    updateParticipants(...updates: ParticipantUpdates[]) {
        this.#updateAndSave((participants) => {
            return this.performParticipantUpdate(participants, ...updates);
        });
    }
    performParticipantUpdate(
        participants: Participant[],
        ...updates: ParticipantUpdates[]
    ) {
        for (const { participant, change } of updates) {
            if (change.initiative) {
                participant.initiative = Number(change.initiative);
                this.tryLog(
                    `${participant.getName()} initiative changed to ${
                        participant.initiative
                    }`
                );
            }
            if (change.name) {
                participant.name = change.name;
                participant.number = 0;
            }
            if (change.hp) {
                // Reduce temp HP first
                change.hp = Number(change.hp);
                if (change.hp < 0 && participant.temp > 0) {
                    const remaining = participant.temp + change.hp;
                    participant.temp = Math.max(0, remaining);
                    change.hp = Math.min(0, remaining);
                }
                // Clamp HP at 0 if clamp is enabled in settings
                if (this.#data.clamp && participant.hp + change.hp < 0) {
                    change.hp = -participant.hp;
                }
                // Handle overflow healing according to settings
                if (
                    change.hp > 0 &&
                    change.hp + participant.hp > participant.current_max
                ) {
                    switch (this.#data.hpOverflow) {
                        case OVERFLOW_TYPE.ignore:
                            change.hp = Math.max(
                                participant.current_max - participant.hp,
                                0
                            );
                            break;
                        case OVERFLOW_TYPE.temp:
                            // Gives temp a value, such that it will be set later
                            change.temp =
                                change.hp -
                                Math.min(participant.current_max - participant.hp, 0);
                            change.hp -= change.temp;
                            break;
                        case OVERFLOW_TYPE.current:
                            break;
                    }
                }
                participant.hp += change.hp;
                if (this.#data.autoStatus && participant.hp <= 0) {
                    const unc = this.#data.statuses.find(
                        (s) => s.id == this.#data.unconsciousId
                    );
                    if (unc) participant.addCondition(unc);
                }
            }
            if (change.max) {
                participant.current_max = Math.max(
                    0,
                    participant.current_max + change.max
                );
                if (
                    participant.hp >= participant.current_max &&
                    this.#data.hpOverflow !== OVERFLOW_TYPE.current
                ) {
                    participant.hp = participant.current_max;
                }
            }
            if (change.set_hp) {
                participant.hp = change.set_hp;
            }
            if (change.set_max_hp) {
                participant.current_max = participant.max = change.set_max_hp;
            }
            if (change.ac) {
                participant.current_ac = participant.ac = change.ac;
            }
            if (change.temp) {
                let baseline = 0;
                if (this.#data.additiveTemp) {
                    baseline = participant.temp;
                }
                if (change.temp > 0) {
                    participant.temp = Math.max(
                        participant.temp,
                        baseline + change.temp
                    );
                } else {
                    participant.temp = Math.max(0, participant.temp + change.temp);
                }
            }
            if (change.marker) {
                participant.marker = change.marker;
            }
            if (change.status?.length) {
                for (const status of change.status) {
                    participant.addCondition(status);
                }
            }
            if (change.remove_status?.length) {
                for (const status of change.remove_status) {
                    participant.removeCondition(status);
                    this.tryLog(
                        `${participant.name} relieved of status ${status.name}`
                    );
                }
            }
            if ("hidden" in change) {
                participant.hidden = change.hidden!;
                this.tryLog(
                    `${participant.getName()} ${
                        participant.hidden ? "hidden" : "revealed"
                    }`
                );
            }
            if ("enabled" in change) {
                participant.enabled = change.enabled!;
                this.tryLog(
                    `${participant.getName()} ${
                        participant.enabled ? "enabled" : "disabled"
                    }`
                );
            }
            if (!participants.includes(participant)) {
                participants.push(participant);
            }
        }
        return participants;
    }
    setUpdate(creature: Participant, evt: MouseEvent) {
        this.updating.update((updatingMap) => {
            if (updatingMap.has(creature)) {
                updatingMap.delete(creature);
            } else {
                updatingMap.set(creature, {
                    saved: evt.getModifierState("Shift"),
                    resist: evt.getModifierState(modifier),
                    customMod: evt.getModifierState("Alt") ? "2" : "1"
                });
            }
            return updatingMap;
        });
    }
    doUpdate(
        toAddString: string,
        statuses: Condition[],
        ac: string,
        removeStatuses: Condition[]
    ) {
        this.updating.update((updatingCreatures) => {
            const messages: UpdateLogMessage[] = [];
            const updates: ParticipantUpdates[] = [];

            updatingCreatures.forEach((entry, participant) => {
                const roundHalf = !toAddString.includes(".");
                const change: ParticipantUpdate = {};
                const modifier =
                    (entry.saved ? 0.5 : 1) *
                    (entry.resist ? 0.5 : 1) *
                    Number(entry.customMod);
                const name = [participant.name];
                if (participant.number > 0) {
                    name.push(`${participant.number}`);
                }
                const message: UpdateLogMessage = {
                    name: name.join(" "),
                    hp: null,
                    temp: false,
                    max: false,
                    status: null,
                    remove_status: null,
                    saved: false,
                    unc: false,
                    ac: null,
                    ac_add: false
                };

                if (toAddString.charAt(0) == "t") {
                    let toAdd = Number(toAddString.slice(1));
                    message.hp = toAdd;
                    message.temp = true;
                    change.temp = toAdd;
                } else {
                    const maxHpDamage = toAddString.charAt(0) === "m";
                    let toAdd = Number(toAddString.slice(+maxHpDamage));
                    toAdd =
                        -1 *
                        Math.sign(toAdd) *
                        Math.max(Math.abs(toAdd) * modifier, 1);
                    toAdd = roundHalf ? Math.trunc(toAdd) : toAdd;
                    message.hp = toAdd;
                    if (maxHpDamage) {
                        message.max = true;
                        change.max = toAdd;
                    }
                    change.hp = toAdd;
                    if (participant.hp <= 0) {
                        message.unc = true;
                    }
                }
                if (statuses.length) {
                    message.status = statuses.map((s) => s.name);
                    if (!entry.saved) {
                        change.status = statuses;
                    } else {
                        message.saved = true;
                    }
                }
                if (removeStatuses.length) {
                    message.remove_status = removeStatuses.map((s) => s.name);
                    change.remove_status = removeStatuses;
                }
                if (ac) {
                    if (ac.charAt(0) == "+" || ac.charAt(0) == "-") {
                        const current_ac = parseInt(
                            String(participant.current_ac)
                        );
                        if (isNaN(current_ac)) {
                            participant.current_ac = participant.current_ac + ac;
                        } else {
                            participant.current_ac = current_ac + parseInt(ac);
                        }
                        message.ac_add = true;
                    } else {
                        participant.current_ac = ac.slice(
                            Number(ac.charAt(0) == "\\")
                        );
                    }
                    message.ac = ac.slice(Number(ac.charAt(0) == "\\"));
                }
                messages.push(message);
                updates.push({ participant, change });
            });
            this.#logger?.logUpdate(messages);
            this.updateParticipants(...updates);
            updatingCreatures.clear();
            return updatingCreatures;
        });
    }
    clearUpdate() {
        this.updating.update((updates) => {
            updates.clear();
            return updates;
        });
    }
}
