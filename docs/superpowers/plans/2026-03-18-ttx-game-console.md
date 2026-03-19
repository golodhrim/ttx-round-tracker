# TTX Game Console Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a TTX Round Console leaf view to the ttx-round-tracker Obsidian plugin that drives a structured four-phase game flow (Declare → DC Set → Roll → Reveal), with delegation, automated D20 outcome resolution, and per-round session log writing.

**Architecture:** A new `src/console/` subtree is added alongside the existing `src/tracker/`. It registers a new Obsidian `ItemView` (`ttx-console-view`) mounted with a Svelte root component that renders either SGM mode or Player mode depending on a plugin setting. Session state lives in a Svelte store backed by a JSON config file in the vault. Per-player action declarations are written to individual JSON files and read by the SGM console. Round finalization appends a structured markdown block to the session log file.

**Tech Stack:** TypeScript, Svelte 4, Obsidian Plugin API (`ItemView`, `vault.adapter`, `vault.on`), Node `node:test` for pure-function unit tests, esbuild + svelte-preprocess (existing build pipeline).

**Spec:** `docs/superpowers/specs/2026-03-18-ttx-game-console-design.md`

---

## File Map

### New files

| File | Responsibility |
|------|---------------|
| `src/console/console.types.ts` | All TS interfaces: `SessionConfig`, `ActionFile`, `RoundState`, `ParticipantRoundEntry`, `OutcomeTier`, `PlayerBonus` |
| `src/console/console.view.ts` | Obsidian `ItemView` subclass that mounts `Console.svelte` |
| `src/console/stores/session.ts` | Svelte store: session config load/save, `currentRound`, `specialRulesUsed`, `pendingModifiers` |
| `src/console/stores/round.ts` | Svelte store: current round declarations, DCs, roll results, outcomes — resets on finalize |
| `src/console/dice/roller.ts` | Pure functions: `rollD(n)`, `determineOutcome(total, dc, rawD20)`, `triggerSecondaryDice(tier)` |
| `src/console/dice/roller.test.ts` | Node `node:test` unit tests for all dice/outcome logic |
| `src/console/io/action-file.ts` | Read/write `actions/[name]-action.json` via `vault.adapter` |
| `src/console/io/character-reader.ts` | Parse bonus data from character `.md` statblock frontmatter |
| `src/console/log/session-log.ts` | Append a formatted round block to the session `.md` file |
| `src/console/ui/Console.svelte` | Root component — detects mode (SGM/player), renders setup or game UI |
| `src/console/ui/setup/SessionSetup.svelte` | Session configuration form (folder picker, participant multi-select, output path) |
| `src/console/ui/setup/SessionResume.svelte` | Prompt to resume existing today's session or start new |
| `src/console/ui/sgm/SGMConsole.svelte` | SGM console root — phase switcher, participant list |
| `src/console/ui/sgm/PhaseBar.svelte` | Round number + current phase indicator |
| `src/console/ui/sgm/ParticipantRow.svelte` | One participant row: name, declaration summary, DC input, roll result, reveal text |
| `src/console/ui/sgm/DelegationSubRow.svelte` | Indented sub-row for a delegating helper under their target |
| `src/console/ui/sgm/SpecialRulesBar.svelte` | Per-session special rule toggles (Phone Call, Override, Reroll) |
| `src/console/ui/player/PlayerConsole.svelte` | Player console root — tabs: My Character / My Action / Session Log / My Notes |
| `src/console/ui/player/ActionForm.svelte` | Mode toggle + action text input |
| `src/console/ui/player/BonusCheckboxes.svelte` | Bonus list with checkboxes loaded from session config |
| `src/console/ui/player/DelegationPicker.svelte` | Scrollable target player selection with greyed-out rules |
| `src/console/ui/player/RollDisplay.svelte` | Shows roll formula + outcome after SGM triggers roll |
| `src/console/ui/player/SessionLogTab.svelte` | Read-only live view of session `.md`, updates on vault modify event |

### Modified files

| File | Change |
|------|--------|
| `src/utils/constants.ts` | Add `TTX_CONSOLE_VIEW = "ttx-console-view"` and `TTX_CONSOLE_SGM_SETTING = "ttxConsoleSGM"` |
| `src/settings/settings.types.ts` | Add `ttxConsoleSGM: boolean` and `ttxConsoleSessionsPath: string` to `InitiativeTrackerData` |
| `src/settings/settings.ts` | Add "TTX Console" settings section: SGM mode toggle, sessions folder path |
| `src/main.ts` | Register `ttx-console-view`, add ribbon icon, register `vault.on('modify')` watcher |

---

## Chunk 1: Foundation — Types, Constants, View Registration

### Task 1: Add constant and settings type

**Files:**
- Modify: `src/utils/constants.ts`
- Modify: `src/settings/settings.types.ts`

- [ ] **Step 1: Add the view type constant**

In `src/utils/constants.ts`, add after the existing `PLAYER_VIEW_VIEW` line:
```typescript
export const TTX_CONSOLE_VIEW = "ttx-console-view";
```

- [ ] **Step 2: Add settings fields to the data type**

In `src/settings/settings.types.ts`, find the `InitiativeTrackerData` interface and add:
```typescript
ttxConsoleSGM: boolean;
ttxConsoleSessionsPath: string;
```

- [ ] **Step 3: Add defaults**

In `src/utils/constants.ts`, in `DEFAULT_SETTINGS`, add:
```typescript
ttxConsoleSGM: false,
ttxConsoleSessionsPath: "04 Sessions",
```

- [ ] **Step 4: Build to verify no breakage**
```bash
cd /Volumes/Data/git-repos/ttx-plugins/ttx-round-tracker && npm run build 2>&1 | tail -5
```
Expected: `Done in` with no errors.

- [ ] **Step 5: Commit**
```bash
git add src/utils/constants.ts src/settings/settings.types.ts
git commit -m "feat(console): add TTX console view constant and settings fields"
```

---

### Task 2: Define all TypeScript types

**Files:**
- Create: `src/console/console.types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// src/console/console.types.ts

export interface PlayerBonus {
    name: string;
    value: number;
    active: boolean;
}

export interface SessionParticipant {
    name: string;
    roleModifier: number;
    delegationModifier: number;
    bonuses: PlayerBonus[];
    specialRule?: string;
}

export interface SessionConfig {
    sessionName: string;
    sessionDate: string;           // YYYY-MM-DD
    charactersFolder: string;      // e.g. "02 Characters/2026"
    participants: SessionParticipant[];
    sessionOutputFile: string;     // e.g. "04 Sessions/2026/2026-03-18-TTX-session.md"
    actionsFolder: string;         // e.g. "04 Sessions/2026/actions"
    status: "active" | "finalized";
    currentRound: number;
    specialRulesUsed: {
        phoneCall: string[];       // player names who have used it
        cLevelOverride: string[];
        certReroll: string[];
    };
    pendingModifiers: Record<string, number>; // player name → modifier (e.g. -1 for partial failure)
}

export type ActionMode = "act" | "delegate" | "skip";

export interface ActionFile {
    round: number;
    player: string;
    mode: ActionMode;
    actionText: string;
    bonuses: PlayerBonus[];
    delegationTarget: string | null;
    delegationText: string;
    skipped: boolean;
    submittedAt: string;           // ISO 8601
}

export type OutcomeTier =
    | "critical-failure"
    | "failure"
    | "partial-failure"
    | "bare-success"
    | "clean-success"
    | "strong-success"
    | "critical-success";

export interface RollResult {
    player: string;
    d20: number;                   // raw D20 value (1–20)
    roleModifier: number;
    bonusTotal: number;            // sum of active bonuses
    delegationBonus: number;       // D12 + helper modifier, 0 if none
    delegationHelper: string | null;
    delegationD12: number | null;
    total: number;                 // d20 + roleModifier + bonusTotal + delegationBonus
    dc: number;
    margin: number;                // total - dc (negative = miss)
    tier: OutcomeTier;
    secondaryDie: { die: number; result: number } | null;
    revealText: string;            // SGM fills in phase 4
}

export interface RoundState {
    round: number;
    phase: "declare" | "dc-set" | "roll" | "reveal";
    declarations: Record<string, ActionFile>;   // player name → action
    dcs: Record<string, number>;                // player name → DC
    results: Record<string, RollResult>;        // player name → roll result
    roundCloseText: string;
}
```

- [ ] **Step 2: Build**
```bash
cd /Volumes/Data/git-repos/ttx-plugins/ttx-round-tracker && npm run build 2>&1 | tail -5
```
Expected: no errors.

- [ ] **Step 3: Commit**
```bash
git add src/console/console.types.ts
git commit -m "feat(console): add TTX console TypeScript types"
```

---

### Task 3: Pure dice and outcome functions + unit tests

**Files:**
- Create: `src/console/dice/roller.ts`
- Create: `src/console/dice/roller.test.ts`

- [ ] **Step 1: Write the failing tests first**

```typescript
// src/console/dice/roller.test.ts
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { rollD, determineOutcome, triggerSecondaryDie } from "./roller.js";

describe("rollD", () => {
    test("rollD(20) returns integer between 1 and 20", () => {
        for (let i = 0; i < 100; i++) {
            const r = rollD(20);
            assert.ok(r >= 1 && r <= 20, `Got ${r}`);
        }
    });
    test("rollD(12) returns integer between 1 and 12", () => {
        for (let i = 0; i < 100; i++) {
            const r = rollD(12);
            assert.ok(r >= 1 && r <= 12, `Got ${r}`);
        }
    });
});

describe("determineOutcome", () => {
    test("natural 1 is always critical-failure", () => {
        assert.equal(determineOutcome(25, 6, 1), "critical-failure");
    });
    test("natural 20 is always critical-success", () => {
        assert.equal(determineOutcome(3, 20, 20), "critical-success");
    });
    test("miss by 6+ is critical-failure", () => {
        assert.equal(determineOutcome(4, 10, 5), "critical-failure");  // margin -6
    });
    test("miss by 3-5 is failure", () => {
        assert.equal(determineOutcome(7, 10, 8), "failure");           // margin -3
    });
    test("miss by 1-2 is partial-failure", () => {
        assert.equal(determineOutcome(9, 10, 10), "partial-failure");  // margin -1
    });
    test("exact DC is bare-success", () => {
        assert.equal(determineOutcome(10, 10, 10), "bare-success");    // margin 0
    });
    test("exceed by 1-3 is clean-success", () => {
        assert.equal(determineOutcome(13, 10, 10), "clean-success");   // margin 3
    });
    test("exceed by 4-6 is strong-success", () => {
        assert.equal(determineOutcome(16, 10, 10), "strong-success");  // margin 6
    });
    test("exceed by 7+ is still strong-success", () => {
        assert.equal(determineOutcome(20, 10, 10), "strong-success");  // margin 10
    });
});

describe("triggerSecondaryDie", () => {
    test("critical-failure triggers D4", () => {
        assert.equal(triggerSecondaryDie("critical-failure").die, 4);
    });
    test("failure triggers D6", () => {
        assert.equal(triggerSecondaryDie("failure").die, 6);
    });
    test("strong-success triggers D8", () => {
        assert.equal(triggerSecondaryDie("strong-success").die, 8);
    });
    test("critical-success triggers D8", () => {
        assert.equal(triggerSecondaryDie("critical-success").die, 8);
    });
    test("bare-success triggers nothing", () => {
        assert.equal(triggerSecondaryDie("bare-success"), null);
    });
    test("clean-success triggers nothing", () => {
        assert.equal(triggerSecondaryDie("clean-success"), null);
    });
    test("partial-failure triggers nothing", () => {
        assert.equal(triggerSecondaryDie("partial-failure"), null);
    });
});
```

- [ ] **Step 2: Run — expect failures (functions don't exist yet)**
```bash
cd /Volumes/Data/git-repos/ttx-plugins/ttx-round-tracker
node --experimental-strip-types --test src/console/dice/roller.test.ts 2>&1 | tail -10
```
Expected: error that `roller.js` cannot be found or functions are undefined.

- [ ] **Step 3: Write the implementation**

```typescript
// src/console/dice/roller.ts
import type { OutcomeTier } from "../console.types";

export function rollD(sides: number): number {
    return Math.floor(Math.random() * sides) + 1;
}

export function determineOutcome(
    total: number,
    dc: number,
    rawD20: number
): OutcomeTier {
    if (rawD20 === 1) return "critical-failure";
    if (rawD20 === 20) return "critical-success";
    const margin = total - dc;
    if (margin <= -6) return "critical-failure";
    if (margin <= -3) return "failure";
    if (margin <= -1) return "partial-failure";
    if (margin === 0) return "bare-success";
    if (margin <= 3) return "clean-success";
    return "strong-success";
}

export function triggerSecondaryDie(
    tier: OutcomeTier
): { die: number; result: number } | null {
    if (tier === "critical-failure") return { die: 4, result: rollD(4) };
    if (tier === "failure") return { die: 6, result: rollD(6) };
    if (tier === "strong-success" || tier === "critical-success")
        return { die: 8, result: rollD(8) };
    return null;
}

export function outcomeLabel(tier: OutcomeTier): string {
    const labels: Record<OutcomeTier, string> = {
        "critical-failure": "💀 Critical Failure",
        "failure": "✗ Failure",
        "partial-failure": "◑ Partial Failure",
        "bare-success": "◎ Bare Success",
        "clean-success": "✓ Clean Success",
        "strong-success": "⬆ Strong Success",
        "critical-success": "⭐ Critical Success"
    };
    return labels[tier];
}
```

- [ ] **Step 4: Run tests — expect all pass**
```bash
node --experimental-strip-types --test src/console/dice/roller.test.ts 2>&1 | tail -15
```
Expected: all tests pass, 0 failures.

- [ ] **Step 5: Build to verify TS types are valid**
```bash
npm run build 2>&1 | tail -5
```
Expected: no errors.

- [ ] **Step 6: Commit**
```bash
git add src/console/dice/
git commit -m "feat(console): add dice roller and D20 outcome resolution with tests"
```

---

### Task 4: Register the TTX Console view in main.ts

**Files:**
- Create: `src/console/console.view.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Create the skeleton view**

```typescript
// src/console/console.view.ts
import { ItemView, WorkspaceLeaf } from "obsidian";
import type InitiativeTracker from "../main";
import { TTX_CONSOLE_VIEW } from "../utils/constants";
import Console from "./ui/Console.svelte";

export const TTX_CONSOLE_ICON = "shield";

export default class TTXConsoleView extends ItemView {
    private ui: Console;

    constructor(
        public leaf: WorkspaceLeaf,
        public plugin: InitiativeTracker
    ) {
        super(leaf);
    }

    getViewType() { return TTX_CONSOLE_VIEW; }
    getDisplayText() { return "TTX Console"; }
    getIcon() { return TTX_CONSOLE_ICON; }

    async onOpen() {
        this.ui = new Console({
            target: this.contentEl,
            props: { plugin: this.plugin }
        });
    }

    async onClose() {
        this.ui?.$destroy();
    }
}
```

- [ ] **Step 2: Create stub Console.svelte so the build succeeds**

```svelte
<!-- src/console/ui/Console.svelte -->
<script lang="ts">
    import type InitiativeTracker from "src/main";
    export let plugin: InitiativeTracker;
</script>

<div class="ttx-console-root">
    <p>TTX Console — loading…</p>
</div>
```

- [ ] **Step 3: Register the view in main.ts**

In `src/main.ts`, add the import near the top with other view imports:
```typescript
import TTXConsoleView from "./console/console.view";
import { TTX_CONSOLE_VIEW } from "./utils/constants";
```

In the `onload()` method of the plugin class, add after the existing `registerView` calls:
```typescript
this.registerView(
    TTX_CONSOLE_VIEW,
    (leaf) => new TTXConsoleView(leaf, this)
);

this.addRibbonIcon("shield", "TTX Console", () => {
    this.activateTTXConsole();
});
```

Add the method to the plugin class:
```typescript
async activateTTXConsole() {
    const existing = this.app.workspace.getLeavesOfType(TTX_CONSOLE_VIEW);
    if (existing.length) {
        this.app.workspace.revealLeaf(existing[0]);
        return;
    }
    const leaf = this.app.workspace.getRightLeaf(false);
    await leaf.setViewState({ type: TTX_CONSOLE_VIEW, active: true });
    this.app.workspace.revealLeaf(leaf);
}
```

- [ ] **Step 4: Build and verify**
```bash
npm run build 2>&1 | tail -5
```
Expected: no errors.

- [ ] **Step 5: Install into vault and verify leaf opens**
```bash
cp main.js "/Users/martinscholz/Library/Mobile Documents/iCloud~md~obsidian/Documents/SecurityTTX/.obsidian/plugins/ttx-round-tracker/main.js"
```
Then in Obsidian: reload the plugin, click the shield ribbon icon — a "TTX Console — loading…" pane should appear in the right sidebar.

- [ ] **Step 6: Commit**
```bash
git add src/console/console.view.ts src/console/ui/Console.svelte src/main.ts
git commit -m "feat(console): register TTX console view and ribbon icon"
```

---

### Task 5: Session config store + IO layer

**Files:**
- Create: `src/console/stores/session.ts`
- Create: `src/console/io/action-file.ts`
- Create: `src/console/io/character-reader.ts`

- [ ] **Step 1: Create the session store**

```typescript
// src/console/stores/session.ts
import { writable, get } from "svelte/store";
import type { App, TFile } from "obsidian";
import type { SessionConfig, SessionParticipant } from "../console.types";

function createSessionStore() {
    const config = writable<SessionConfig | null>(null);
    const configPath = writable<string | null>(null);

    async function load(app: App, path: string): Promise<void> {
        try {
            const raw = await app.vault.adapter.read(path);
            config.set(JSON.parse(raw));
            configPath.set(path);
        } catch {
            config.set(null);
        }
    }

    async function save(app: App): Promise<void> {
        const path = get(configPath);
        const cfg = get(config);
        if (!path || !cfg) return;
        await app.vault.adapter.write(path, JSON.stringify(cfg, null, 2));
    }

    async function create(
        app: App,
        cfg: SessionConfig,
        sessionsBasePath: string
    ): Promise<void> {
        const filename = `${cfg.sessionDate}-${cfg.sessionName.replace(/\s+/g, "-")}.json`;
        const fullPath = `${sessionsBasePath}/${filename}`;
        // Ensure sessions directory exists
        if (!(await app.vault.adapter.exists(sessionsBasePath))) {
            await app.vault.createFolder(sessionsBasePath);
        }
        // Ensure actions directory exists
        if (!(await app.vault.adapter.exists(cfg.actionsFolder))) {
            await app.vault.createFolder(cfg.actionsFolder);
        }
        await app.vault.adapter.write(fullPath, JSON.stringify(cfg, null, 2));
        config.set(cfg);
        configPath.set(fullPath);
    }

    async function findTodaysSession(
        app: App,
        sessionsBasePath: string
    ): Promise<string | null> {
        const today = new Date().toISOString().slice(0, 10);
        try {
            const { files } = await app.vault.adapter.list(sessionsBasePath);
            return files.find((f) => f.includes(today) && f.endsWith(".json")) ?? null;
        } catch {
            return null;
        }
    }

    function incrementRound(app: App) {
        config.update((cfg) => {
            if (!cfg) return cfg;
            cfg.currentRound += 1;
            return cfg;
        });
        save(app);
    }

    function markSpecialRuleUsed(
        app: App,
        rule: keyof SessionConfig["specialRulesUsed"],
        playerName: string
    ) {
        config.update((cfg) => {
            if (!cfg) return cfg;
            if (!cfg.specialRulesUsed[rule].includes(playerName)) {
                cfg.specialRulesUsed[rule].push(playerName);
            }
            return cfg;
        });
        save(app);
    }

    function setPendingModifier(app: App, playerName: string, mod: number) {
        config.update((cfg) => {
            if (!cfg) return cfg;
            cfg.pendingModifiers[playerName] = mod;
            return cfg;
        });
        save(app);
    }

    function clearPendingModifier(app: App, playerName: string) {
        config.update((cfg) => {
            if (!cfg) return cfg;
            delete cfg.pendingModifiers[playerName];
            return cfg;
        });
        save(app);
    }

    return {
        subscribe: config.subscribe,
        configPath,
        load,
        save,
        create,
        findTodaysSession,
        incrementRound,
        markSpecialRuleUsed,
        setPendingModifier,
        clearPendingModifier
    };
}

export const sessionStore = createSessionStore();
```

- [ ] **Step 2: Create the action file IO helper**

```typescript
// src/console/io/action-file.ts
import type { App } from "obsidian";
import type { ActionFile } from "../console.types";

export async function writeActionFile(
    app: App,
    actionsFolder: string,
    action: ActionFile
): Promise<void> {
    const safeName = action.player.replace(/\s+/g, "-");
    const path = `${actionsFolder}/${safeName}-action.json`;
    await app.vault.adapter.write(path, JSON.stringify(action, null, 2));
}

export async function readActionFile(
    app: App,
    actionsFolder: string,
    playerName: string
): Promise<ActionFile | null> {
    const safeName = playerName.replace(/\s+/g, "-");
    const path = `${actionsFolder}/${safeName}-action.json`;
    try {
        const raw = await app.vault.adapter.read(path);
        return JSON.parse(raw) as ActionFile;
    } catch {
        return null;
    }
}

export async function readAllActionFiles(
    app: App,
    actionsFolder: string,
    participants: string[]
): Promise<Record<string, ActionFile>> {
    const results: Record<string, ActionFile> = {};
    await Promise.all(
        participants.map(async (name) => {
            const action = await readActionFile(app, actionsFolder, name);
            if (action) results[name] = action;
        })
    );
    return results;
}

/** Resolve delegation conflicts: first submittedAt wins. */
export function resolveConflicts(
    actions: Record<string, ActionFile>
): { resolved: Record<string, ActionFile>; conflicts: string[] } {
    const targetMap: Map<string, { player: string; at: number }> = new Map();
    const conflicts: string[] = [];

    // Sort by submission time so we process earliest first
    const sorted = Object.entries(actions).sort(
        ([, a], [, b]) =>
            new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
    );

    const resolved = Object.fromEntries(
        sorted.map(([name, action]) => [name, { ...action }])
    );

    for (const [name, action] of sorted) {
        if (action.mode !== "delegate" || !action.delegationTarget) continue;
        const target = action.delegationTarget;
        if (targetMap.has(target)) {
            // Conflict: revert this player to "act"
            resolved[name] = { ...action, mode: "act", delegationTarget: null };
            conflicts.push(name);
        } else {
            targetMap.set(target, {
                player: name,
                at: new Date(action.submittedAt).getTime()
            });
        }
    }
    return { resolved, conflicts };
}
```

- [ ] **Step 3: Create the character file reader**

```typescript
// src/console/io/character-reader.ts
import type { App } from "obsidian";
import type { SessionParticipant, PlayerBonus } from "../console.types";

interface RawStatblock {
    name?: string;
    modifier?: string;
    bonus?: string;
    delegation?: string;
    special?: string;
}

function parseModifier(raw: string | undefined): number {
    if (!raw) return 0;
    const match = raw.match(/([+-]?\d+)/);
    return match ? parseInt(match[1], 10) : 0;
}

function parseBonuses(raw: string | undefined): PlayerBonus[] {
    if (!raw || raw === "~") return [];
    return raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((entry) => {
            // e.g. "Azure +2" or "Security Cert +3"
            const match = entry.match(/^(.+?)\s+([+-]\d+)$/);
            if (!match) return null;
            return {
                name: match[1].trim(),
                value: parseInt(match[2], 10),
                active: false
            };
        })
        .filter((b): b is PlayerBonus => b !== null);
}

function parseDelegationModifier(raw: string | undefined): number {
    if (!raw) return 0;
    // e.g. "Roll D12 + 4 when assisting another player"
    const match = raw.match(/D12\s*\+\s*(\d+)/i);
    return match ? parseInt(match[1], 10) : 0;
}

export async function readParticipantFromFile(
    app: App,
    folder: string,
    filename: string
): Promise<SessionParticipant | null> {
    const path = `${folder}/${filename}`;
    try {
        const content = await app.vault.adapter.read(path);
        // Extract ```statblock ... ``` block
        const match = content.match(/```statblock\n([\s\S]*?)```/);
        if (!match) return null;

        const { parseYaml } = await import("obsidian");
        const raw = parseYaml(match[1]) as RawStatblock;
        if (!raw?.name) return null;

        return {
            name: raw.name,
            roleModifier: parseModifier(raw.modifier),
            delegationModifier: parseDelegationModifier(raw.delegation),
            bonuses: parseBonuses(raw.bonus),
            specialRule: raw.special && raw.special !== "~" ? raw.special : undefined
        };
    } catch {
        return null;
    }
}

export async function readAllParticipants(
    app: App,
    folder: string
): Promise<SessionParticipant[]> {
    try {
        const { files } = await app.vault.adapter.list(folder);
        const mdFiles = files.filter(
            (f) =>
                f.endsWith(".md") &&
                !f.includes("Player-Template") &&
                !f.includes("Player-Registry") &&
                !f.includes("Player-Cards")
        );
        const results = await Promise.all(
            mdFiles.map((f) => {
                const filename = f.split("/").pop()!;
                return readParticipantFromFile(app, folder, filename);
            })
        );
        return results.filter((p): p is SessionParticipant => p !== null);
    } catch {
        return [];
    }
}
```

- [ ] **Step 4: Build**
```bash
npm run build 2>&1 | tail -5
```
Expected: no errors.

- [ ] **Step 5: Commit**
```bash
git add src/console/stores/session.ts src/console/io/
git commit -m "feat(console): add session store and IO helpers (action files, character reader)"
```

---

## Chunk 2: Session Setup UI + Player Action Form

### Task 6: Session resume + setup screens

**Files:**
- Create: `src/console/stores/round.ts`
- Create: `src/console/ui/setup/SessionResume.svelte`
- Create: `src/console/ui/setup/SessionSetup.svelte`
- Modify: `src/console/ui/Console.svelte`

- [ ] **Step 1: Create the round store**

```typescript
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
```

- [ ] **Step 2: Create SessionResume.svelte**

```svelte
<!-- src/console/ui/setup/SessionResume.svelte -->
<script lang="ts">
    import type InitiativeTracker from "src/main";
    import { sessionStore } from "../../stores/session";
    import type { SessionConfig } from "../../console.types";

    export let plugin: InitiativeTracker;
    export let existingPath: string;
    export let onResume: (cfg: SessionConfig) => void;
    export let onNew: () => void;

    async function resume() {
        await sessionStore.load(plugin.app, existingPath);
        const cfg = plugin.app.vault.adapter.read(existingPath)
            .then((r) => JSON.parse(r) as SessionConfig)
            .then(onResume);
    }
</script>

<div class="ttx-setup">
    <h3>TTX Console</h3>
    <p>A session from today was found. Would you like to resume it?</p>
    <p class="path">{existingPath.split("/").pop()}</p>
    <div class="actions">
        <button class="mod-cta" on:click={resume}>Resume session</button>
        <button on:click={onNew}>Start new session</button>
    </div>
</div>

<style scoped>
    .ttx-setup { padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
    .path { color: var(--text-muted); font-size: var(--font-small); font-style: italic; }
    .actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
</style>
```

- [ ] **Step 3: Create SessionSetup.svelte**

```svelte
<!-- src/console/ui/setup/SessionSetup.svelte -->
<script lang="ts">
    import type InitiativeTracker from "src/main";
    import { readAllParticipants } from "../../io/character-reader";
    import { sessionStore } from "../../stores/session";
    import type { SessionConfig, SessionParticipant } from "../../console.types";

    export let plugin: InitiativeTracker;
    export let onConfigured: (cfg: SessionConfig) => void;

    const today = new Date().toISOString().slice(0, 10);
    let sessionName = `TTX Game Day ${today.slice(0, 4)}`;
    let sessionDate = today;
    let charactersFolder = "02 Characters/" + today.slice(0, 4);
    let sessionOutputFile = `04 Sessions/${today.slice(0, 4)}/${today}-TTX-session.md`;
    let actionsFolder = `04 Sessions/${today.slice(0, 4)}/actions`;

    let availableParticipants: SessionParticipant[] = [];
    let selectedNames: Set<string> = new Set();
    let loading = false;
    let folderError = "";

    async function loadParticipants() {
        loading = true;
        folderError = "";
        availableParticipants = await readAllParticipants(plugin.app, charactersFolder);
        if (!availableParticipants.length) {
            folderError = "No character files found in this folder.";
        }
        loading = false;
    }

    function toggleParticipant(name: string) {
        if (selectedNames.has(name)) selectedNames.delete(name);
        else selectedNames.add(name);
        selectedNames = new Set(selectedNames);
    }

    async function startSession() {
        const selected = availableParticipants.filter((p) =>
            selectedNames.has(p.name)
        );
        if (!selected.length) return;

        const sessionsBasePath = plugin.data.ttxConsoleSessionsPath +
            `/${today.slice(0, 4)}/.sessions`;

        const cfg: SessionConfig = {
            sessionName,
            sessionDate,
            charactersFolder,
            participants: selected,
            sessionOutputFile,
            actionsFolder,
            status: "active",
            currentRound: 1,
            specialRulesUsed: { phoneCall: [], cLevelOverride: [], certReroll: [] },
            pendingModifiers: {}
        };

        await sessionStore.create(plugin.app, cfg, sessionsBasePath);
        onConfigured(cfg);
    }
</script>

<div class="ttx-setup">
    <h3>New TTX Session</h3>

    <label>Session name
        <input type="text" bind:value={sessionName} />
    </label>

    <label>Session date
        <input type="date" bind:value={sessionDate} />
    </label>

    <label>Characters folder
        <div class="row">
            <input type="text" bind:value={charactersFolder} />
            <button on:click={loadParticipants}>Load</button>
        </div>
        {#if folderError}<p class="error">{folderError}</p>{/if}
    </label>

    {#if availableParticipants.length}
        <div class="participant-list">
            <p class="label">Select participants</p>
            {#each availableParticipants as p}
                <label class="participant-item">
                    <input
                        type="checkbox"
                        checked={selectedNames.has(p.name)}
                        on:change={() => toggleParticipant(p.name)}
                    />
                    <span class="name">{p.name}</span>
                    <span class="modifier">+{p.roleModifier}</span>
                </label>
            {/each}
        </div>
    {/if}

    <label>Session output file
        <input type="text" bind:value={sessionOutputFile} />
    </label>

    <label>Actions folder
        <input type="text" bind:value={actionsFolder} />
    </label>

    <button
        class="mod-cta"
        disabled={!selectedNames.size}
        on:click={startSession}
    >
        Start session →
    </button>
</div>

<style scoped>
    .ttx-setup { padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem; font-size: var(--font-small); }
    label { display: flex; flex-direction: column; gap: 0.25rem; }
    input[type="text"], input[type="date"] { width: 100%; }
    .row { display: flex; gap: 0.5rem; }
    .participant-list { display: flex; flex-direction: column; gap: 0.25rem; border: 1px solid var(--background-modifier-border); border-radius: 4px; padding: 0.5rem; }
    .participant-item { display: flex; align-items: center; gap: 0.5rem; flex-direction: row; }
    .modifier { color: var(--color-blue); font-size: var(--font-smallest); margin-left: auto; }
    .error { color: var(--color-red); font-size: var(--font-smallest); }
    .label { font-size: var(--font-smallest); text-transform: uppercase; color: var(--text-muted); margin: 0; }
</style>
```

- [ ] **Step 4: Update Console.svelte to wire setup flow**

```svelte
<!-- src/console/ui/Console.svelte -->
<script lang="ts">
    import type InitiativeTracker from "src/main";
    import { onMount } from "svelte";
    import { sessionStore } from "../stores/session";
    import type { SessionConfig } from "../console.types";
    import SessionResume from "./setup/SessionResume.svelte";
    import SessionSetup from "./setup/SessionSetup.svelte";

    export let plugin: InitiativeTracker;

    type Screen = "loading" | "resume" | "setup" | "sgm" | "player";
    let screen: Screen = "loading";
    let existingSessionPath: string | null = null;
    let activeConfig: SessionConfig | null = null;

    onMount(async () => {
        const sessionsBase =
            plugin.data.ttxConsoleSessionsPath + "/" +
            new Date().toISOString().slice(0, 4) + "/.sessions";
        existingSessionPath = await sessionStore.findTodaysSession(
            plugin.app,
            sessionsBase
        );
        screen = existingSessionPath ? "resume" : "setup";
    });

    function onResume(cfg: SessionConfig) {
        activeConfig = cfg;
        screen = plugin.data.ttxConsoleSGM ? "sgm" : "player";
    }

    function onConfigured(cfg: SessionConfig) {
        activeConfig = cfg;
        screen = plugin.data.ttxConsoleSGM ? "sgm" : "player";
    }
</script>

<div class="ttx-console-root">
    {#if screen === "loading"}
        <p class="ttx-loading">Loading…</p>
    {:else if screen === "resume" && existingSessionPath}
        <SessionResume
            {plugin}
            existingPath={existingSessionPath}
            {onResume}
            onNew={() => (screen = "setup")}
        />
    {:else if screen === "setup"}
        <SessionSetup {plugin} {onConfigured} />
    {:else if screen === "sgm"}
        <p>SGM Console — coming in Chunk 3</p>
    {:else if screen === "player"}
        <p>Player Console — coming in Chunk 2 Task 7</p>
    {/if}
</div>

<style>
    .ttx-console-root { height: 100%; overflow: auto; }
    .ttx-loading { padding: 1rem; color: var(--text-muted); }
</style>
```

- [ ] **Step 5: Build and install**
```bash
npm run build 2>&1 | tail -5
cp main.js "/Users/martinscholz/Library/Mobile Documents/iCloud~md~obsidian/Documents/SecurityTTX/.obsidian/plugins/ttx-round-tracker/main.js"
```
Reload plugin in Obsidian. Open the console. You should see the "New TTX Session" setup form. Click "Load" after typing `02 Characters/2026` — character names should appear.

- [ ] **Step 6: Commit**
```bash
git add src/console/stores/round.ts src/console/ui/
git commit -m "feat(console): add session setup and resume screens"
```

---

### Task 7: Player action form

**Files:**
- Create: `src/console/ui/player/ActionForm.svelte`
- Create: `src/console/ui/player/BonusCheckboxes.svelte`
- Create: `src/console/ui/player/DelegationPicker.svelte`
- Create: `src/console/ui/player/RollDisplay.svelte`
- Create: `src/console/ui/player/SessionLogTab.svelte`
- Create: `src/console/ui/player/PlayerConsole.svelte`

- [ ] **Step 1: Create BonusCheckboxes.svelte**

```svelte
<!-- src/console/ui/player/BonusCheckboxes.svelte -->
<script lang="ts">
    import type { PlayerBonus } from "src/console/console.types";
    export let bonuses: PlayerBonus[];

    function toggle(bonus: PlayerBonus) {
        bonus.active = !bonus.active;
        bonuses = [...bonuses];
    }
</script>

{#if bonuses.length}
    <div class="bonus-list">
        <p class="label">Which bonuses apply?</p>
        {#each bonuses as bonus}
            <label class="bonus-item" class:active={bonus.active}>
                <input
                    type="checkbox"
                    bind:checked={bonus.active}
                    on:change={() => toggle(bonus)}
                />
                {bonus.name}
                <span class="val">{bonus.value > 0 ? "+" : ""}{bonus.value}</span>
            </label>
        {/each}
    </div>
{/if}

<style scoped>
    .bonus-list { display: flex; flex-direction: column; gap: 0.2rem; }
    .label { font-size: var(--font-smallest); text-transform: uppercase; color: var(--text-muted); margin: 0 0 0.25rem 0; }
    .bonus-item { display: flex; align-items: center; gap: 0.4rem; flex-direction: row; font-size: var(--font-small); padding: 2px 4px; border-radius: 3px; cursor: pointer; }
    .bonus-item.active { background: var(--background-modifier-success-hover); }
    .val { color: var(--color-green); margin-left: auto; font-size: var(--font-smallest); }
</style>
```

- [ ] **Step 2: Create DelegationPicker.svelte**

```svelte
<!-- src/console/ui/player/DelegationPicker.svelte -->
<script lang="ts">
    export let participants: string[];
    export let myName: string;
    export let takenTargets: Set<string>;     // already being assisted
    export let delegatingPlayers: Set<string>; // players who are delegating (ineligible as targets)
    export let selected: string | null;
    export let delegationText: string = "";

    function isDisabled(name: string) {
        return (
            name === myName ||
            takenTargets.has(name) ||
            delegatingPlayers.has(name)
        );
    }
    function disabledReason(name: string): string {
        if (takenTargets.has(name)) return "already being assisted";
        if (delegatingPlayers.has(name)) return "is delegating";
        return "";
    }
</script>

<div class="picker">
    <p class="label">Who are you assisting?</p>
    {#each participants as name}
        {#if name !== myName}
            <label
                class="player-option"
                class:disabled={isDisabled(name)}
                class:selected={selected === name}
            >
                <input
                    type="radio"
                    bind:group={selected}
                    value={name}
                    disabled={isDisabled(name)}
                />
                <span class="name">{name}</span>
                {#if isDisabled(name)}
                    <span class="reason">{disabledReason(name)}</span>
                {/if}
            </label>
        {/if}
    {/each}

    {#if selected}
        <div class="delegation-desc">
            <p class="label">What are you helping with?</p>
            <textarea
                bind:value={delegationText}
                placeholder="Describe your contribution..."
                rows="2"
            />
        </div>
    {/if}
</div>

<style scoped>
    .picker { display: flex; flex-direction: column; gap: 0.25rem; }
    .label { font-size: var(--font-smallest); text-transform: uppercase; color: var(--text-muted); margin: 0 0 0.25rem 0; }
    .player-option { display: flex; align-items: center; gap: 0.4rem; flex-direction: row; padding: 3px 6px; border-radius: 3px; font-size: var(--font-small); cursor: pointer; border: 1px solid transparent; }
    .player-option.selected { border-color: var(--color-orange); background: var(--background-modifier-hover); }
    .player-option.disabled { opacity: 0.4; cursor: not-allowed; }
    .reason { color: var(--text-muted); font-size: var(--font-smallest); margin-left: auto; font-style: italic; }
    .delegation-desc { margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.25rem; }
    textarea { width: 100%; resize: vertical; font-size: var(--font-small); }
</style>
```

- [ ] **Step 3: Create ActionForm.svelte**

```svelte
<!-- src/console/ui/player/ActionForm.svelte -->
<script lang="ts">
    import type { App } from "obsidian";
    import type { SessionParticipant, ActionFile, ActionMode } from "src/console/console.types";
    import BonusCheckboxes from "./BonusCheckboxes.svelte";
    import DelegationPicker from "./DelegationPicker.svelte";
    import { writeActionFile } from "src/console/io/action-file";

    export let app: App;
    export let participant: SessionParticipant;
    export let allParticipants: string[];
    export let actionsFolder: string;
    export let currentRound: number;
    export let takenTargets: Set<string>;
    export let delegatingPlayers: Set<string>;
    export let pendingModifier: number;  // -1 from partial failure, 0 normally
    export let onSubmit: (action: ActionFile) => void;

    let mode: ActionMode = "act";
    let actionText = "";
    let delegationTarget: string | null = null;
    let delegationText = "";
    let bonuses = participant.bonuses.map((b) => ({ ...b, active: false }));
    let submitted = false;

    $: bonusTotal = bonuses.filter((b) => b.active).reduce((s, b) => s + b.value, 0);
    $: rollPreview = mode === "delegate"
        ? `D12 + Role(${participant.delegationModifier > 0 ? "+" : ""}${participant.delegationModifier})`
        : `D20 + Role(+${participant.roleModifier})${bonusTotal ? ` + Bonuses(+${bonusTotal})` : ""}${pendingModifier ? ` + carry-over(${pendingModifier})` : ""}`;

    async function submit() {
        const action: ActionFile = {
            round: currentRound,
            player: participant.name,
            mode,
            actionText: mode === "act" ? actionText : "",
            bonuses,
            delegationTarget: mode === "delegate" ? delegationTarget : null,
            delegationText: mode === "delegate" ? delegationText : "",
            skipped: mode === "skip",
            submittedAt: new Date().toISOString()
        };
        await writeActionFile(app, actionsFolder, action);
        submitted = true;
        onSubmit(action);
    }
</script>

<div class="action-form">
    <p class="round-label">Round {currentRound}</p>

    {#if pendingModifier !== 0}
        <div class="carry-over">
            ⚠ Partial failure carry-over: {pendingModifier} to this roll
        </div>
    {/if}

    <!-- Mode toggle -->
    <div class="mode-toggle">
        <button
            class:active={mode === "act"}
            on:click={() => (mode = "act")}
            disabled={submitted}
        >Act independently</button>
        <button
            class:active={mode === "delegate"}
            on:click={() => (mode = "delegate")}
            disabled={submitted}
        >↳ Delegate</button>
        <button
            class:active={mode === "skip"}
            on:click={() => (mode = "skip")}
            disabled={submitted}
        >— Skip</button>
    </div>

    {#if mode === "act"}
        <textarea
            bind:value={actionText}
            placeholder="What do you want to do this round?"
            rows="3"
            disabled={submitted}
        />
        <BonusCheckboxes bind:bonuses />

    {:else if mode === "delegate"}
        <DelegationPicker
            participants={allParticipants}
            myName={participant.name}
            {takenTargets}
            {delegatingPlayers}
            bind:selected={delegationTarget}
            bind:delegationText
        />
        <div class="warning">⚠ You cannot act independently this round once submitted</div>

    {:else if mode === "skip"}
        <p class="skip-note">You will pass this round — no roll, no DC.</p>
    {/if}

    <div class="roll-preview">{rollPreview}</div>

    {#if !submitted}
        <button
            class="mod-cta submit-btn"
            on:click={submit}
            disabled={
                (mode === "act" && !actionText.trim()) ||
                (mode === "delegate" && (!delegationTarget || !delegationText.trim()))
            }
        >
            Submit →
        </button>
    {:else}
        <div class="submitted-badge">✓ Submitted — waiting for SGM</div>
    {/if}
</div>

<style scoped>
    .action-form { display: flex; flex-direction: column; gap: 0.6rem; padding: 0.5rem; font-size: var(--font-small); }
    .round-label { font-size: var(--font-smallest); text-transform: uppercase; color: var(--text-muted); margin: 0; }
    .carry-over { background: var(--background-modifier-error); border-radius: 4px; padding: 4px 8px; font-size: var(--font-smallest); }
    .mode-toggle { display: flex; border: 1px solid var(--background-modifier-border); border-radius: 4px; overflow: hidden; }
    .mode-toggle button { flex: 1; border: none; border-radius: 0; padding: 4px 0; font-size: var(--font-small); cursor: pointer; background: transparent; }
    .mode-toggle button.active { background: var(--interactive-accent); color: var(--text-on-accent); }
    textarea { width: 100%; resize: vertical; }
    .warning { color: var(--color-red); font-size: var(--font-smallest); }
    .skip-note { color: var(--text-muted); font-style: italic; }
    .roll-preview { background: var(--background-secondary); border-radius: 3px; padding: 4px 8px; font-size: var(--font-smallest); color: var(--color-blue); }
    .submit-btn { width: 100%; }
    .submitted-badge { text-align: center; color: var(--color-green); font-size: var(--font-small); padding: 4px; }
</style>
```

- [ ] **Step 4: Create SessionLogTab.svelte**

```svelte
<!-- src/console/ui/player/SessionLogTab.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import type { App, TAbstractFile } from "obsidian";

    export let app: App;
    export let sessionOutputFile: string;

    let content = "";
    let error = "";
    let unsubscribe: (() => void) | null = null;

    async function loadContent() {
        try {
            content = await app.vault.adapter.read(sessionOutputFile);
        } catch {
            error = "Session log not yet created.";
        }
    }

    onMount(async () => {
        await loadContent();
        // Watch for updates via vault modify events
        const handler = (file: TAbstractFile) => {
            if (file.path === sessionOutputFile) loadContent();
        };
        app.vault.on("modify", handler);
        unsubscribe = () => app.vault.off("modify", handler);
    });

    onDestroy(() => unsubscribe?.());
</script>

<div class="log-tab">
    <div class="readonly-badge">👁 Read-only · Synced · Updates live</div>
    {#if error}
        <p class="empty">{error}</p>
    {:else}
        <pre class="log-content">{content}</pre>
    {/if}
</div>

<style scoped>
    .log-tab { display: flex; flex-direction: column; height: 100%; }
    .readonly-badge { background: var(--background-modifier-hover); padding: 3px 8px; font-size: var(--font-smallest); color: var(--color-orange); border-bottom: 1px solid var(--background-modifier-border); }
    .log-content { flex: 1; overflow: auto; padding: 0.75rem; font-size: var(--font-smallest); white-space: pre-wrap; word-break: break-word; margin: 0; }
    .empty { color: var(--text-muted); padding: 1rem; font-style: italic; }
</style>
```

- [ ] **Step 5: Create PlayerConsole.svelte**

```svelte
<!-- src/console/ui/player/PlayerConsole.svelte -->
<script lang="ts">
    import type InitiativeTracker from "src/main";
    import type { SessionConfig, SessionParticipant, ActionFile } from "src/console/console.types";
    import ActionForm from "./ActionForm.svelte";
    import SessionLogTab from "./SessionLogTab.svelte";
    import { roundStore } from "../../stores/round";
    import { get } from "svelte/store";

    export let plugin: InitiativeTracker;
    export let config: SessionConfig;
    export let participant: SessionParticipant;

    type Tab = "character" | "action" | "log" | "notes";
    let activeTab: Tab = "action";
    let logHasUpdate = false;
    let notes = "";

    const round = get(roundStore);

    $: takenTargets = new Set(
        Object.values(round.declarations)
            .filter((a) => a.mode === "delegate" && a.delegationTarget)
            .map((a) => a.delegationTarget!)
    );
    $: delegatingPlayers = new Set(
        Object.values(round.declarations)
            .filter((a) => a.mode === "delegate")
            .map((a) => a.player)
    );

    $: pendingModifier = config.pendingModifiers[participant.name] ?? 0;

    function onActionSubmit(action: ActionFile) {
        roundStore.setDeclaration(participant.name, action);
    }

    function switchTab(tab: Tab) {
        activeTab = tab;
        if (tab === "log") logHasUpdate = false;
    }
</script>

<div class="player-console">
    <div class="tabs">
        <button class:active={activeTab === "character"} on:click={() => switchTab("character")}>🃏 My Character</button>
        <button class:active={activeTab === "action"} on:click={() => switchTab("action")}>🎲 My Action</button>
        <button class:active={activeTab === "log"} on:click={() => switchTab("log")}>
            📋 Session Log {#if logHasUpdate}<span class="dot">●</span>{/if}
        </button>
        <button class:active={activeTab === "notes"} on:click={() => switchTab("notes")}>📓 My Notes</button>
    </div>

    <div class="tab-content">
        {#if activeTab === "character"}
            <p class="placeholder">Character card — opens in Obsidian from your character file.</p>
        {:else if activeTab === "action"}
            <ActionForm
                app={plugin.app}
                {participant}
                allParticipants={config.participants.map((p) => p.name)}
                actionsFolder={config.actionsFolder}
                currentRound={config.currentRound}
                {takenTargets}
                {delegatingPlayers}
                {pendingModifier}
                onSubmit={onActionSubmit}
            />
        {:else if activeTab === "log"}
            <SessionLogTab
                app={plugin.app}
                sessionOutputFile={config.sessionOutputFile}
            />
        {:else if activeTab === "notes"}
            <div class="notes-tab">
                <p class="private-note">Not synced — stays on this device only</p>
                <textarea bind:value={notes} placeholder="Your personal notes..." rows="15" />
            </div>
        {/if}
    </div>
</div>

<style scoped>
    .player-console { display: flex; flex-direction: column; height: 100%; }
    .tabs { display: flex; border-bottom: 1px solid var(--background-modifier-border); flex-shrink: 0; }
    .tabs button { flex: 1; border: none; border-bottom: 2px solid transparent; padding: 5px 2px; font-size: var(--font-smallest); cursor: pointer; background: transparent; }
    .tabs button.active { border-bottom-color: var(--interactive-accent); color: var(--interactive-accent); }
    .dot { color: var(--color-orange); }
    .tab-content { flex: 1; overflow: auto; }
    .placeholder { color: var(--text-muted); padding: 1rem; font-style: italic; font-size: var(--font-small); }
    .notes-tab { padding: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem; height: 100%; }
    .private-note { font-size: var(--font-smallest); color: var(--text-muted); font-style: italic; margin: 0; }
    textarea { flex: 1; resize: none; width: 100%; }
</style>
```

- [ ] **Step 6: Wire PlayerConsole into Console.svelte**

Replace the player branch in `Console.svelte`:
```svelte
{:else if screen === "player" && activeConfig}
    <PlayerConsole
        {plugin}
        config={activeConfig}
        participant={activeConfig.participants[0]}
    />
```
Add the import at the top of the script block:
```typescript
import PlayerConsole from "./player/PlayerConsole.svelte";
```

- [ ] **Step 7: Build and verify**
```bash
npm run build 2>&1 | tail -5
cp main.js "/Users/martinscholz/Library/Mobile Documents/iCloud~md~obsidian/Documents/SecurityTTX/.obsidian/plugins/ttx-round-tracker/main.js"
```
In Obsidian: set SGM mode to OFF in settings. Open console. After completing setup, the four-tab player view should appear. Test action submission: type an action, check a bonus, click Submit. Verify the action JSON file is created in the vault under the actions folder.

- [ ] **Step 8: Commit**
```bash
git add src/console/ui/player/
git commit -m "feat(console): add player action form with bonus checkboxes, delegation picker, session log tab"
```

---

## Chunk 3: SGM Console — DC Input, Roll Automation, Reveal

### Task 8: SGM participant rows and phase management

**Files:**
- Create: `src/console/ui/sgm/PhaseBar.svelte`
- Create: `src/console/ui/sgm/DelegationSubRow.svelte`
- Create: `src/console/ui/sgm/ParticipantRow.svelte`
- Create: `src/console/ui/sgm/SpecialRulesBar.svelte`
- Create: `src/console/ui/sgm/SGMConsole.svelte`

- [ ] **Step 1: Create PhaseBar.svelte**

```svelte
<!-- src/console/ui/sgm/PhaseBar.svelte -->
<script lang="ts">
    import type { RoundState } from "src/console/console.types";
    export let round: number;
    export let phase: RoundState["phase"];
    export let declaredCount: number;
    export let totalActive: number;

    const phaseLabels: Record<RoundState["phase"], string> = {
        "declare": "1 — Declare",
        "dc-set": "2 — DC Set",
        "roll": "3 — Roll",
        "reveal": "4 — Reveal"
    };
</script>

<div class="phase-bar">
    <span class="round">Round {round}</span>
    <div class="phases">
        {#each Object.entries(phaseLabels) as [key, label]}
            <span class="phase" class:active={phase === key}>{label}</span>
        {/each}
    </div>
    {#if phase === "declare"}
        <span class="count">{declaredCount}/{totalActive}</span>
    {/if}
</div>

<style scoped>
    .phase-bar { display: flex; align-items: center; gap: 0.5rem; padding: 4px 8px; background: var(--background-secondary); border-bottom: 1px solid var(--background-modifier-border); font-size: var(--font-smallest); flex-shrink: 0; flex-wrap: wrap; }
    .round { font-weight: bold; color: var(--text-normal); }
    .phases { display: flex; gap: 4px; flex: 1; }
    .phase { padding: 2px 6px; border-radius: 10px; color: var(--text-muted); }
    .phase.active { background: var(--interactive-accent); color: var(--text-on-accent); }
    .count { color: var(--color-orange); font-weight: bold; }
</style>
```

- [ ] **Step 2: Create DelegationSubRow.svelte**

```svelte
<!-- src/console/ui/sgm/DelegationSubRow.svelte -->
<script lang="ts">
    import type { ActionFile, RollResult } from "src/console/console.types";
    export let helper: string;
    export let action: ActionFile;
    export let result: RollResult | null;
</script>

<div class="sub-row">
    <span class="arrow">↳</span>
    <span class="name">{helper}</span>
    {#if action.delegationText}
        <span class="desc">{action.delegationText}</span>
    {/if}
    {#if result}
        <span class="roll">D12({result.delegationD12}) + Role(+{result.delegationBonus - (result.delegationD12 ?? 0)}) = +{result.delegationBonus}</span>
        {#if result.tier === "bare-success" || result.tier === "clean-success" || result.tier === "strong-success" || result.tier === "critical-success"}
            <span class="note">Unavailable next round</span>
        {/if}
    {:else}
        <span class="meta">D12 + modifier</span>
    {/if}
</div>

<style scoped>
    .sub-row { display: flex; align-items: center; gap: 0.4rem; padding: 3px 8px 3px 1.5rem; background: var(--background-modifier-hover); border-top: 1px solid var(--background-modifier-border); font-size: var(--font-smallest); flex-wrap: wrap; }
    .arrow { color: var(--color-orange); }
    .name { color: var(--color-orange); font-weight: bold; }
    .desc { color: var(--text-muted); font-style: italic; flex: 1; }
    .roll { color: var(--text-muted); margin-left: auto; }
    .meta { color: var(--text-faint); }
    .note { color: var(--text-faint); font-style: italic; }
</style>
```

- [ ] **Step 3: Create ParticipantRow.svelte**

```svelte
<!-- src/console/ui/sgm/ParticipantRow.svelte -->
<script lang="ts">
    import type { ActionFile, RollResult, RoundState, OutcomeTier } from "src/console/console.types";
    import { outcomeLabel } from "src/console/dice/roller";
    import DelegationSubRow from "./DelegationSubRow.svelte";

    export let name: string;
    export let phase: RoundState["phase"];
    export let action: ActionFile | null;
    export let dc: number | null;
    export let result: RollResult | null;
    export let helperAction: ActionFile | null;    // if someone is delegating to this participant
    export let helperName: string | null;
    export let helperResult: RollResult | null;
    export let onDCChange: (dc: number) => void;
    export let onRevealChange: (text: string) => void;

    const DC_LABELS: [number, string][] = [
        [6, "Trivial"], [8, "Easy"], [10, "Moderate"], [12, "Challenging"],
        [14, "Hard"], [16, "Very Hard"], [18, "Extreme"], [20, "Near-impossible"]
    ];

    function dcLabel(n: number): string {
        return DC_LABELS.find(([v]) => v === n)?.[1] ?? "";
    }

    $: tierClass = result ? result.tier : "";
    $: isSkipped = action?.mode === "skip";
    $: isDelegating = action?.mode === "delegate";
</script>

<div class="participant-row" class:skipped={isSkipped} class:delegating={isDelegating}>
    <div class="main-row">
        <span class="name">{name}</span>

        {#if isSkipped}
            <span class="skip-badge">— skipped</span>
        {:else if isDelegating}
            <span class="delegate-badge">↳ → {action?.delegationTarget}</span>
        {:else if action}
            <span class="action-text">{action.actionText}</span>
        {:else}
            <span class="waiting">⏳ waiting…</span>
        {/if}

        {#if !isSkipped && !isDelegating}
            {#if phase === "dc-set" || phase === "roll" || phase === "reveal"}
                <div class="dc-control">
                    <input
                        type="number"
                        min="6" max="20" step="2"
                        value={dc ?? ""}
                        on:change={(e) => onDCChange(parseInt(e.currentTarget.value, 10))}
                    />
                    <span class="dc-label">{dc ? dcLabel(dc) : ""}</span>
                </div>
            {/if}

            {#if result}
                <div class="result {tierClass}">
                    {outcomeLabel(result.tier)}
                    <span class="margin">({result.margin >= 0 ? "+" : ""}{result.margin})</span>
                    {#if result.secondaryDie}
                        <span class="secondary">D{result.secondaryDie.die}: {result.secondaryDie.result}</span>
                    {/if}
                </div>
            {/if}
        {/if}

        {#if helperName && !isSkipped}
            <span class="helper-badge">+ {helperName} assisting</span>
        {/if}
    </div>

    {#if helperName && helperAction}
        <DelegationSubRow
            helper={helperName}
            action={helperAction}
            result={helperResult}
        />
    {/if}

    {#if phase === "reveal" && result && !isSkipped && !isDelegating}
        <div class="reveal-row">
            <textarea
                placeholder="SGM reveal — what happened…"
                rows="2"
                value={result.revealText}
                on:input={(e) => onRevealChange(e.currentTarget.value)}
            />
        </div>
    {/if}
</div>

<style scoped>
    .participant-row { border: 1px solid var(--background-modifier-border); border-radius: 4px; margin-bottom: 3px; overflow: hidden; }
    .main-row { display: flex; align-items: center; gap: 0.4rem; padding: 5px 7px; flex-wrap: wrap; font-size: var(--font-small); }
    .name { font-weight: bold; color: var(--color-blue); min-width: 80px; }
    .action-text { flex: 1; color: var(--text-muted); font-style: italic; font-size: var(--font-smallest); }
    .waiting { flex: 1; color: var(--text-faint); }
    .skip-badge { flex: 1; color: var(--text-faint); font-style: italic; }
    .delegate-badge { flex: 1; color: var(--color-orange); font-size: var(--font-smallest); }
    .dc-control { display: flex; align-items: center; gap: 4px; }
    .dc-control input { width: 40px; text-align: center; }
    .dc-label { font-size: var(--font-smallest); color: var(--text-muted); }
    .result { padding: 2px 6px; border-radius: 3px; font-size: var(--font-smallest); font-weight: bold; }
    .result.clean-success, .result.strong-success, .result.critical-success, .result.bare-success { background: var(--background-modifier-success-hover); color: var(--color-green); }
    .result.partial-failure { background: var(--background-modifier-hover); color: var(--color-yellow); }
    .result.failure, .result.critical-failure { background: var(--background-modifier-error-hover); color: var(--color-red); }
    .margin { font-weight: normal; color: var(--text-muted); }
    .secondary { color: var(--color-purple); }
    .helper-badge { background: var(--background-modifier-hover); border: 1px solid var(--color-orange); border-radius: 10px; padding: 1px 6px; font-size: var(--font-smallest); color: var(--color-orange); }
    .reveal-row { padding: 4px 7px; border-top: 1px solid var(--background-modifier-border); }
    .reveal-row textarea { width: 100%; resize: vertical; font-size: var(--font-small); }
    .skipped { opacity: 0.5; }
</style>
```

- [ ] **Step 4: Create SpecialRulesBar.svelte**

```svelte
<!-- src/console/ui/sgm/SpecialRulesBar.svelte -->
<script lang="ts">
    import type { SessionConfig } from "src/console/console.types";
    export let config: SessionConfig;

    const RULES = [
        { key: "phoneCall" as const, label: "📞 Phone Call" },
        { key: "cLevelOverride" as const, label: "⚡ C-Level Override" },
        { key: "certReroll" as const, label: "🔄 Cert Reroll" }
    ];
</script>

<div class="special-rules">
    {#each RULES as rule}
        <div class="rule-group">
            <span class="rule-name">{rule.label}</span>
            {#each config.participants.filter(p => p.specialRule || rule.key === "phoneCall") as p}
                <span
                    class="player-tag"
                    class:used={config.specialRulesUsed[rule.key].includes(p.name)}
                    title={p.name}
                >
                    {p.name.split(" ")[0]}
                </span>
            {/each}
        </div>
    {/each}
</div>

<style scoped>
    .special-rules { display: flex; gap: 0.75rem; padding: 4px 8px; background: var(--background-secondary); border-bottom: 1px solid var(--background-modifier-border); font-size: var(--font-smallest); flex-wrap: wrap; }
    .rule-group { display: flex; align-items: center; gap: 4px; }
    .rule-name { color: var(--text-muted); }
    .player-tag { background: var(--background-modifier-hover); border-radius: 10px; padding: 1px 6px; cursor: pointer; }
    .player-tag.used { opacity: 0.35; text-decoration: line-through; }
</style>
```

- [ ] **Step 5: Create SGMConsole.svelte**

```svelte
<!-- src/console/ui/sgm/SGMConsole.svelte -->
<script lang="ts">
    import type InitiativeTracker from "src/main";
    import type { SessionConfig, ActionFile, RollResult } from "src/console/console.types";
    import { roundStore } from "../../stores/round";
    import { sessionStore } from "../../stores/session";
    import { readAllActionFiles, resolveConflicts } from "../../io/action-file";
    import { rollD, determineOutcome, triggerSecondaryDie } from "../../dice/roller";
    import { appendRoundToLog } from "../../log/session-log";
    import PhaseBar from "./PhaseBar.svelte";
    import ParticipantRow from "./ParticipantRow.svelte";
    import SpecialRulesBar from "./SpecialRulesBar.svelte";
    import { get } from "svelte/store";

    export let plugin: InitiativeTracker;
    export let config: SessionConfig;

    $: round = $roundStore;
    $: activeParticipants = config.participants.filter(
        (p) => round.declarations[p.name]?.mode !== "skip" &&
               round.declarations[p.name]?.mode !== "delegate"
    );
    $: declaredCount = Object.keys(round.declarations).length;
    $: allDeclared = declaredCount === config.participants.length;
    $: allDCsSet = activeParticipants.every((p) => round.dcs[p.name] != null);
    $: allRevealed = activeParticipants.every(
        (p) => (round.results[p.name]?.revealText ?? "").trim().length > 0
    );

    // Who is delegating to whom
    $: delegationMap = Object.fromEntries(
        Object.values(round.declarations)
            .filter((a) => a.mode === "delegate" && a.delegationTarget)
            .map((a) => [a.delegationTarget!, a.player])
    );

    let roundCloseText = "";
    let pollingTimer: ReturnType<typeof setInterval>;

    // Poll action files every 3s during declare phase
    $: if (round.phase === "declare") {
        pollingTimer = setInterval(pollActions, 3000);
    } else {
        clearInterval(pollingTimer);
    }

    async function pollActions() {
        const files = await readAllActionFiles(
            plugin.app,
            config.actionsFolder,
            config.participants.map((p) => p.name)
        );
        const { resolved } = resolveConflicts(files);
        Object.entries(resolved).forEach(([name, action]) => {
            roundStore.setDeclaration(name, action);
        });
    }

    function advanceToDC() {
        roundStore.advancePhase("dc-set");
    }

    function rollAll() {
        roundStore.advancePhase("roll");
        for (const p of activeParticipants) {
            const action = round.declarations[p.name];
            const dc = round.dcs[p.name] ?? 10;
            const helperName = delegationMap[p.name];
            const helperAction = helperName ? round.declarations[helperName] : null;
            const helperParticipant = helperName
                ? config.participants.find((q) => q.name === helperName)
                : null;

            const d20 = rollD(20);
            const bonusTotal = action?.bonuses
                .filter((b) => b.active)
                .reduce((s, b) => s + b.value, 0) ?? 0;
            const pendingMod = config.pendingModifiers[p.name] ?? 0;

            let delegationD12: number | null = null;
            let delegationBonus = 0;
            if (helperParticipant) {
                delegationD12 = rollD(12);
                delegationBonus = delegationD12 + helperParticipant.delegationModifier;
            }

            const total = d20 + p.roleModifier + bonusTotal + pendingMod + delegationBonus;
            const tier = determineOutcome(total, dc, d20);
            const secondary = triggerSecondaryDie(tier);

            const result: RollResult = {
                player: p.name,
                d20,
                roleModifier: p.roleModifier,
                bonusTotal,
                delegationBonus,
                delegationHelper: helperName ?? null,
                delegationD12,
                total,
                dc,
                margin: total - dc,
                tier,
                secondaryDie: secondary,
                revealText: ""
            };
            roundStore.setResult(p.name, result);
        }
        roundStore.advancePhase("reveal");
    }

    function updateReveal(playerName: string, text: string) {
        const current = get(roundStore).results[playerName];
        if (!current) return;
        roundStore.setResult(playerName, { ...current, revealText: text });
    }

    async function finalizeRound() {
        const state = get(roundStore);
        // Apply coordination costs and partial failure modifiers
        for (const p of activeParticipants) {
            const result = state.results[p.name];
            if (!result) continue;
            // Partial failure: set -1 carry-over
            if (result.tier === "partial-failure") {
                sessionStore.setPendingModifier(plugin.app, p.name, -1);
            } else {
                sessionStore.clearPendingModifier(plugin.app, p.name);
            }
        }
        // Apply delegation coordination cost (helper must skip next round if success)
        for (const [target, helper] of Object.entries(delegationMap)) {
            const result = state.results[target];
            if (result && result.tier !== "failure" && result.tier !== "critical-failure") {
                sessionStore.setPendingModifier(plugin.app, helper, -99); // sentinel = must-skip
            }
        }

        await appendRoundToLog(plugin.app, config, state, roundCloseText);
        sessionStore.incrementRound(plugin.app);
        roundStore.reset(config.currentRound + 1);
        roundCloseText = "";
    }
</script>

<div class="sgm-console">
    <PhaseBar
        round={config.currentRound}
        phase={round.phase}
        declaredCount={declaredCount}
        totalActive={config.participants.length}
    />

    <SpecialRulesBar {config} />

    <div class="participants">
        {#each config.participants as p}
            {#if round.declarations[p.name]?.mode !== "delegate"}
                <ParticipantRow
                    name={p.name}
                    phase={round.phase}
                    action={round.declarations[p.name] ?? null}
                    dc={round.dcs[p.name] ?? null}
                    result={round.results[p.name] ?? null}
                    helperName={delegationMap[p.name] ?? null}
                    helperAction={delegationMap[p.name]
                        ? round.declarations[delegationMap[p.name]]
                        : null}
                    helperResult={delegationMap[p.name]
                        ? round.results[p.name] ?? null
                        : null}
                    onDCChange={(dc) => roundStore.setDC(p.name, dc)}
                    onRevealChange={(text) => updateReveal(p.name, text)}
                />
            {/if}
        {/each}
    </div>

    <div class="phase-actions">
        {#if round.phase === "declare"}
            <button class="mod-cta" disabled={!allDeclared} on:click={advanceToPC}>
                All declared → Set DCs
            </button>
            <button on:click={pollActions}>↻ Refresh</button>
        {:else if round.phase === "dc-set"}
            <div class="dc-quickset">
                {#each [6,8,10,12,14,16,18,20] as v}
                    <button class="dc-quick" on:click={() => {
                        activeParticipants.forEach(p => !round.dcs[p.name] && roundStore.setDC(p.name, v));
                    }}>{v}</button>
                {/each}
            </div>
            <button class="mod-cta" disabled={!allDCsSet} on:click={rollAll}>
                🎲 Roll All
            </button>
        {:else if round.phase === "reveal"}
            <div class="round-close">
                <textarea
                    bind:value={roundCloseText}
                    placeholder="SGM round close — overall narrative (optional)…"
                    rows="2"
                />
            </div>
            <button class="mod-cta" disabled={!allRevealed} on:click={finalizeRound}>
                ✓ Finalize Round {config.currentRound} → Write Log
            </button>
        {/if}
    </div>
</div>

<style scoped>
    .sgm-console { display: flex; flex-direction: column; height: 100%; font-size: var(--font-small); }
    .participants { flex: 1; overflow: auto; padding: 6px; }
    .phase-actions { border-top: 1px solid var(--background-modifier-border); padding: 8px; display: flex; flex-direction: column; gap: 6px; }
    .dc-quickset { display: flex; gap: 4px; flex-wrap: wrap; }
    .dc-quick { padding: 2px 8px; font-size: var(--font-smallest); }
    .round-close textarea { width: 100%; resize: vertical; }
</style>
```

Fix the typo in SGMConsole (`advanceToPC` should be `advanceToPC → advanceToPC`; use `advanceToPC = () => roundStore.advancePhase("dc-set")`).

Actually replace the onclick with just `on:click={() => roundStore.advancePhase("dc-set")}`.

- [ ] **Step 6: Wire SGMConsole into Console.svelte**

Replace the SGM branch:
```svelte
{:else if screen === "sgm" && activeConfig}
    <SGMConsole {plugin} config={activeConfig} />
```
Add import:
```typescript
import SGMConsole from "./sgm/SGMConsole.svelte";
```

- [ ] **Step 7: Build and verify**
```bash
npm run build 2>&1 | tail -5
cp main.js "/Users/martinscholz/Library/Mobile Documents/iCloud~md~obsidian/Documents/SecurityTTX/.obsidian/plugins/ttx-round-tracker/main.js"
```
In Obsidian: enable SGM mode in settings. Open console, configure a session with 2–3 participants. Advance through all four phases manually. Verify roll results appear automatically with correct outcome tiers.

- [ ] **Step 8: Commit**
```bash
git add src/console/ui/sgm/
git commit -m "feat(console): add SGM console with four-phase round flow and automated rolling"
```

---

## Chunk 4: Session Log Writer

### Task 9: Append round block to session markdown

**Files:**
- Create: `src/console/log/session-log.ts`

- [ ] **Step 1: Write the log formatter and appender**

```typescript
// src/console/log/session-log.ts
import type { App } from "obsidian";
import type { SessionConfig, RoundState, RollResult, ActionFile } from "../console.types";
import { outcomeLabel } from "../dice/roller";

function formatRollLine(result: RollResult): string {
    const parts = [
        `D20(${result.d20})`,
        `${result.roleModifier >= 0 ? "+" : ""}Role(${result.roleModifier >= 0 ? "+" : ""}${result.roleModifier})`
    ];
    if (result.bonusTotal) parts.push(`+Bonuses(+${result.bonusTotal})`);
    if (result.delegationBonus) {
        parts.push(`+[delegation: +${result.delegationBonus}]`);
    }
    return `${parts.join(" ")} = **${result.total}** vs DC ${result.dc}`;
}

function formatParticipantBlock(
    result: RollResult,
    action: ActionFile,
    helperResult: RollResult | null
): string {
    const lines: string[] = [];
    lines.push(`**${result.player}** · ${action.actionText}`);
    lines.push(`Roll: ${formatRollLine(result)}`);
    if (helperResult && result.delegationHelper) {
        lines.push(
            `*(Delegation from ${result.delegationHelper}: ` +
            `D12(${result.delegationD12}) + Role(+${helperResult.roleModifier}) = ` +
            `+${result.delegationBonus} — see ${result.delegationHelper}'s entry below)*`
        );
    }
    const secondary = result.secondaryDie
        ? ` · D${result.secondaryDie.die}: ${result.secondaryDie.result}`
        : "";
    lines.push(`Outcome: ${outcomeLabel(result.tier)} (${result.margin >= 0 ? "+" : ""}${result.margin})${secondary}`);
    if (result.revealText) {
        lines.push(`> "${result.revealText}"`);
    }
    return lines.join("\n");
}

function formatDelegatingBlock(
    helper: string,
    result: RollResult
): string {
    const lines: string[] = [];
    lines.push(`**${helper}** → assisting ${result.player}`);
    lines.push(
        `D12(${result.delegationD12}) + Role(+${result.roleModifier}) = ` +
        `**+${result.delegationBonus}** contributed to ${result.player}'s total`
    );
    if (result.tier !== "failure" && result.tier !== "critical-failure") {
        lines.push(`*(Unavailable next round — coordination cost)*`);
    }
    return lines.join("\n");
}

export async function appendRoundToLog(
    app: App,
    config: SessionConfig,
    state: RoundState,
    roundCloseText: string
): Promise<void> {
    const now = new Date().toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit"
    });
    const lines: string[] = [
        ``,
        `## Round ${state.round} — ${config.sessionDate} ${now}`,
        ``,
        `---`,
        ``
    ];

    // Delegation map: target → helper name
    const delegationMap = Object.fromEntries(
        Object.values(state.declarations)
            .filter((a) => a.mode === "delegate" && a.delegationTarget)
            .map((a) => [a.delegationTarget!, a.player])
    );

    for (const p of config.participants) {
        const action = state.declarations[p.name];
        if (!action) continue;

        if (action.mode === "skip") {
            lines.push(`**${p.name}** — passed this round`);
        } else if (action.mode === "delegate") {
            const primaryResult = state.results[action.delegationTarget!];
            if (primaryResult) {
                lines.push(formatDelegatingBlock(p.name, primaryResult));
            }
        } else {
            const result = state.results[p.name];
            if (!result) continue;
            const helperName = delegationMap[p.name];
            const helperResult = helperName ? state.results[helperName] : null;
            lines.push(formatParticipantBlock(result, action, helperResult));
        }
        lines.push(``);
        lines.push(`---`);
        lines.push(``);
    }

    if (roundCloseText.trim()) {
        lines.push(`⚡ **SGM — Round ${state.round} close:** "${roundCloseText.trim()}"`);
        lines.push(``);
        lines.push(`---`);
        lines.push(``);
    }

    const block = lines.join("\n");

    // Ensure the output file exists
    if (!(await app.vault.adapter.exists(config.sessionOutputFile))) {
        const header = [
            `# ${config.sessionName}`,
            ``,
            `**Date:** ${config.sessionDate}`,
            `**Participants:** ${config.participants.map((p) => p.name).join(", ")}`,
            ``
        ].join("\n");
        await app.vault.adapter.write(config.sessionOutputFile, header);
    }

    // Append the round block
    const existing = await app.vault.adapter.read(config.sessionOutputFile);
    await app.vault.adapter.write(config.sessionOutputFile, existing + block);
}
```

- [ ] **Step 2: Build and install**
```bash
npm run build 2>&1 | tail -5
cp main.js "/Users/martinscholz/Library/Mobile Documents/iCloud~md~obsidian/Documents/SecurityTTX/.obsidian/plugins/ttx-round-tracker/main.js"
```

- [ ] **Step 3: Full integration test**

In Obsidian with SGM mode on:
1. Configure a new session with 2+ participants
2. Run one complete round (declare → DC → roll → reveal → finalize)
3. Open the session output file — verify the markdown block was appended with correct dice lines and outcome text
4. Switch to a player device (or disable SGM mode), open the Session Log tab — verify the live content appears

- [ ] **Step 4: Commit**
```bash
git add src/console/log/session-log.ts
git commit -m "feat(console): add session log writer with formatted round blocks"
```

---

## Chunk 5: Settings UI + Workspace Layouts

### Task 10: Settings panel for TTX Console

**Files:**
- Modify: `src/settings/settings.ts`

- [ ] **Step 1: Add TTX Console settings section**

In `src/settings/settings.ts`, locate the end of the `display()` method and add a new settings section:

```typescript
// TTX Console section
const ttxContainer = containerEl.createEl("details");
new Setting(ttxContainer.createEl("summary"))
    .setHeading()
    .setName("TTX Console");
ttxContainer.createDiv("collapser").createDiv("handle");

new Setting(ttxContainer)
    .setName("SGM Mode")
    .setDesc(
        "Enable on the Scenario Game Master's device. Shows the full console with DC input, roll controls, and finalize. Disable on player devices."
    )
    .addToggle((t) => {
        t.setValue(this.plugin.data.ttxConsoleSGM).onChange(async (v) => {
            this.plugin.data.ttxConsoleSGM = v;
            await this.plugin.saveSettings();
        });
    });

new Setting(ttxContainer)
    .setName("Sessions Folder")
    .setDesc(
        "Base folder where session config files are stored. Default: 04 Sessions"
    )
    .addText((t) => {
        t.setValue(this.plugin.data.ttxConsoleSessionsPath).onChange(
            async (v) => {
                this.plugin.data.ttxConsoleSessionsPath = v;
                await this.plugin.saveSettings();
            }
        );
    });
```

- [ ] **Step 2: Build and verify settings appear**
```bash
npm run build 2>&1 | tail -5
cp main.js "/Users/martinscholz/Library/Mobile Documents/iCloud~md~obsidian/Documents/SecurityTTX/.obsidian/plugins/ttx-round-tracker/main.js"
```
Open Obsidian settings → TTX Round Tracker. Scroll to bottom — a "TTX Console" section should be present.

- [ ] **Step 3: Commit**
```bash
git add src/settings/settings.ts
git commit -m "feat(console): add TTX Console settings (SGM mode, sessions folder)"
```

---

### Task 11: Obsidian workspace layouts

**Files:**
- Modify: `/Users/martinscholz/Library/Mobile Documents/iCloud~md~obsidian/Documents/SecurityTTX/.obsidian/workspaces.json` (create if absent)

- [ ] **Step 1: Check current workspaces.json**
```bash
cat "/Users/martinscholz/Library/Mobile Documents/iCloud~md~obsidian/Documents/SecurityTTX/.obsidian/workspaces.json" 2>/dev/null | head -5 || echo "MISSING"
```

- [ ] **Step 2: Write the SGM and Player workspaces**

The workspaces JSON defines named layouts. Add two named workspaces — `SGM` and `Player` — to the existing file. The key structure Obsidian expects:
```json
{
  "workspaces": {
    "SGM": { ... },
    "Player": { ... }
  },
  "active": "SGM"
}
```

For the SGM workspace: left sidebar with file-explorer and bookmarks, main area with a markdown leaf for the session log file, right split with the initiative tracker view (top) and TTX console view (bottom).

For the Player workspace: main area with four-tab group (character file, action form, session log, notes), right sidebar slim for private notes file.

Exact workspace JSON leaf IDs must be freshly generated random hex strings. Use:
```bash
node -e "console.log(require('crypto').randomBytes(8).toString('hex'))"
```
to generate each ID before writing the JSON.

- [ ] **Step 3: Verify workspaces appear in Obsidian**

In Obsidian: open the command palette → "Manage workspaces" — both `SGM` and `Player` should be listed and loadable without errors.

- [ ] **Step 4: Commit**
```bash
git -C /Volumes/Data/git-repos/ttx-plugins/ttx-round-tracker add -f main.js styles.css
git -C /Volumes/Data/git-repos/ttx-plugins/ttx-round-tracker commit -m "feat(console): complete TTX console build — all chunks implemented"
git -C /Volumes/Data/git-repos/ttx-plugins/ttx-round-tracker push origin main
```

---

## Build Verification Checklist

After all chunks are complete:

- [ ] `npm run build` produces no errors
- [ ] SGM mode: full round cycle (declare → DC → roll → reveal → finalize) completes without errors
- [ ] Session log file is created on first finalize, appended on subsequent rounds
- [ ] Player mode: action submission writes JSON to actions folder
- [ ] Delegation: conflict resolution reverts late-submitter to act mode
- [ ] Natural 1 always produces critical-failure; Natural 20 always critical-success
- [ ] Partial failure sets pendingModifiers in session config; next round shows −1 carry-over
- [ ] Session resume correctly loads existing today's session
- [ ] Session Log tab on player device updates when SGM finalizes a round
- [ ] Plugin installed in SecurityTTX vault, both workspaces load cleanly
