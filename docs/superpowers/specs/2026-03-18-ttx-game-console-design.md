# TTX Game Console — Design Specification

**Date:** 2026-03-18
**Status:** Under review
**Scope:** ttx-round-tracker plugin extension + Obsidian vault configuration + Syncthing setup

---

## 1. Overview

The TTX Game Console extends the existing `ttx-round-tracker` Obsidian plugin with a structured round-based game flow. It handles session configuration, action declaration, difficulty assignment, automated dice resolution, delegation, and session logging — shared across the SGM's projected screen and each player's personal device via Syncthing.

The system is designed around three principles:
- **Load sharing**: players self-serve on their own device; SGM can enter on behalf of anyone
- **Always visible**: all game state is live and legible on every screen at all times
- **Automatic record**: by end of session, a complete structured log exists with no manual note-taking

---

## 2. Architecture

### Approach: Extend ttx-round-tracker (Option A)

A new Obsidian leaf view type (`ttx-console`) is added to the existing `ttx-round-tracker` plugin. One plugin handles everything:

- Turn order spine (existing tracker)
- Session configuration (new — see §3)
- Round console UI (new)
- Automated dice resolution (new)
- Session log writer (new)
- Character bonus reader (new — reads from character `.md` frontmatter/statblock)

No inter-plugin API required. The console reads participant data directly from the tracker store.

### 2.1 Action File Schema

Each player's declaration is written to `04 Sessions/[year]/actions/[name]-action.json`:

```json
{
  "round": 3,
  "player": "Damian Ickler",
  "mode": "delegate",
  "actionText": "Pulling API call logs to narrow the blast radius",
  "bonuses": [
    { "name": "Security Cert", "value": 3, "active": false },
    { "name": "Azure Cert", "value": 2, "active": false }
  ],
  "delegationTarget": "Georgi Stanchev",
  "delegationText": "Pulling API call logs for the account",
  "skipped": false,
  "submittedAt": "2026-03-18T14:32:07Z"
}
```

Fields:
- `mode`: `"act"` | `"delegate"` | `"skip"`
- `bonuses`: all bonuses available to the player; `active: true` means ticked for this action
- `delegationTarget`: full player name string; null if mode is not `"delegate"`
- `submittedAt`: ISO 8601 timestamp — used for delegation conflict resolution (see §6)

### 2.2 File Responsibilities

| File | Owner | Synced |
|------|-------|--------|
| `04 Sessions/[year]/[date]-[name]-session.md` | SGM device (written on round finalize) | ✓ Yes — all devices |
| `04 Sessions/[year]/actions/[name]-action.json` | Each player's device | ✓ Yes — SGM reads these |
| `private/[name]-notes.md` | Each player's device | ✗ No — local only |
| `02 Characters/[year]/[name].md` | SGM device (source of bonus data) | ✓ Yes |
| `.obsidian/plugins/ttx-round-tracker/sessions/[date]-[name].json` | SGM device | ✓ Yes — session config |

### 2.3 Live-Update Mechanism

Player devices detect new rounds via Obsidian's `vault.on('modify', ...)` file watcher on the session `.md` file. When Syncthing delivers an updated `session.md` to a player device, the OS filesystem event fires and Obsidian's watcher triggers the Session Log tab indicator.

Syncthing must be configured in default mode (not "in-place" or temp-file-only) to ensure filesystem modification events fire correctly. This is the default on macOS and Linux. Verified behaviour required before Game Day.

### 2.4 Syncthing Exclusions

Per player device:
- Exclude: `GM/`, `03 Scenarios/`, `private/` (other players' private folders)
- Include: `01 Ruleset/`, `02 Characters/`, `04 Sessions/`, `05 Board-Game/`
- Include: `.obsidian/plugins/ttx-round-tracker/sessions/` — session config files are authored by the SGM and must be readable on all player devices so their consoles reflect the correct participant list, output path, and round state. Player devices treat this path as **read-only** (they never write to session config files — only the SGM device does). If Syncthing detects a conflict on a session config file, the SGM device's version always wins (configure via Syncthing's "Folder Master" / `sendOnly` mode on the SGM device for this subfolder).

---

## 3. Session Configuration (Game Day Setup)

Before the round flow can begin, the SGM creates a **session configuration**. This is saved per game day and can be reloaded if the session is interrupted.

### 3.1 Configuration Fields

| Field | Description |
|-------|-------------|
| **Session name** | Free text, e.g. "TTX Game Day 2026" |
| **Session date** | Date picker, defaults to today |
| **Characters folder** | Path to the folder containing this game day's character `.md` files (e.g. `02 Characters/2026/`) |
| **Participants** | Multi-select from characters found in the chosen folder — SGM picks who is playing today |
| **Session output file** | Path and filename for the session log (e.g. `04 Sessions/2026/2026-03-18-TTX-session.md`) |
| **Actions folder** | Path for per-player action JSON files (defaults to `04 Sessions/[year]/actions/`) |

### 3.2 Configuration Behaviour

- On launch, the TTX Console checks for an existing session config for today's date and offers to resume it
- A "New session" button clears the config and opens the setup form
- Past session configs are listed and can be reopened for review (read-only after finalized)
- The participant list from the config drives all subsequent UI: only configured participants appear in the round console and tracker
- The characters folder selection determines where bonus data is read from — this allows different game years or custom character sets to be used without changing plugin settings globally

### 3.3 Config Storage

Saved to `.obsidian/plugins/ttx-round-tracker/sessions/[date]-[name].json`. Example:

```json
{
  "sessionName": "TTX Game Day 2026",
  "sessionDate": "2026-03-18",
  "charactersFolder": "02 Characters/2026",
  "participants": [
    "Georgi Stanchev",
    "Thomas Neumann",
    "Michael Vöhringer",
    "Andreas Gardt",
    "Damian Ickler",
    "Anja Witczak"
  ],
  "sessionOutputFile": "04 Sessions/2026/2026-03-18-TTX-session.md",
  "actionsFolder": "04 Sessions/2026/actions",
  "status": "active",
  "currentRound": 2,
  "specialRulesUsed": {
    "phoneCall": [],
    "cLevelOverride": [],
    "certReroll": []
  },
  "pendingModifiers": {
    "Andreas Gardt": -1
  }
}
```

---

## 4. Workspace Layouts

### SGM Workspace (`SGM` workspace in Obsidian)

| Panel | Location | Content |
|-------|----------|---------|
| Left sidebar | File explorer + Bookmarks | Quick access to: Current Scenario, Session Log, Quick Reference |
| Main pane (centre) | Tabbed | Tab 1: Live Session Log · Tab 2: Scenario Notes |
| Right sidebar | Stacked | Top: Round Tracker (turn order spine) · Bottom: TTX Console (SGM mode) |

### Player Workspace (`Player` workspace in Obsidian)

Four tabs in the main pane, right sidebar for private notes:

| Tab | Content | Sync |
|-----|---------|------|
| My Character | Character statblock card (read-only) | ✓ |
| My Action | Action input, bonus checkboxes, delegation, roll result | ✓ (action file) |
| Session Log ● | Read-only view of `session.md`, live updates | ✓ |
| My Notes | Free-form personal notes | ✗ local only |

The Session Log tab shows an orange live indicator dot (●) when a new round is finalized, triggered by the file-watcher mechanism described in §2.3.

---

## 5. Round Flow

Each round passes through four phases in sequence. The SGM drives the transition between phases; players act within their phase.

```
DECLARE → DC SET → ROLL → REVEAL & FINALIZE
(players)  (SGM)  (auto)  (SGM + auto log)
```

### Phase 1 — Declare

- Each player opens their "My Action" tab
- Chooses one of three modes:
  - **Act independently**: types action text, ticks applicable bonus checkboxes
  - **Delegate**: selects target player, describes contribution (see §6)
  - **Skip**: passes the round with no roll
- Submission writes to `actions/[name]-action.json` with `submittedAt` timestamp
- SGM console shows live count (N/6 declared) and can enter on behalf of any player verbally
- Edge case — all players skip: if all participants have submitted with `mode: "skip"`, the console skips Phase 2 and Phase 3 entirely, shows a "Finalize (all passed)" button, and writes a round block of skip entries with the SGM round close narrative

### Phase 2 — DC Set (SGM only)

- All declarations visible in the console
- SGM clicks into each participant's DC field and sets a number (6–20)
- A quick-set bar (6·8·10·12·14·16·18·20) with difficulty labels speeds entry
- Delegating players: shown as a sub-row under their target; no independent DC field
- Skipping players: no DC field shown, greyed out
- SGM advances to Phase 3 when all active (non-skipping) participants have a DC

### Phase 3 — Roll (automated)

SGM presses "Roll All". The system resolves all rolls simultaneously:

**Independent player roll:**
```
Total = D20(random) + role_modifier + sum(active_bonuses)
```

**Delegating player roll:**
```
Delegation bonus = D12(random) + helper_role_modifier
Primary total = D20(primary) + primary_modifier + primary_active_bonuses + delegation_bonus
```

**Outcome tier** determined automatically from the ruleset (see §7).
**Secondary dice** triggered automatically where required (see §7).

### Phase 4 — Reveal & Finalize

- Each participant's result row shows outcome tier and a text field for the SGM's narrative reveal
- SGM types a short reveal text per participant (what actually happened in the scenario)
- At the bottom of the console, a **round close narrative** field allows the SGM to write an overall closing statement for the round (e.g. "The attacker is still inside. Next round the stakes go up."). This field is optional — the round can be finalized without it, leaving the round close blank in the log.
- "Finalize Round" button (enabled once all per-participant reveal texts are non-empty — active participants only; skipping and conflict-reset players whose delegation was reverted per §6.2 and who have not re-declared are treated as skipping for finalize gate purposes, requiring no reveal text):
  - Writes the complete round block to `session.md` (appended)
  - Triggers file-watcher notification on all player devices (Session Log tab indicator)
  - Resets the console for the next round
  - Records coordination costs and persistent modifiers (see §6.4 and §7.10)
  - Increments `currentRound` in the session config file

---

## 6. Delegation System

### 6.1 Declaration (player device)

The "My Action" tab shows a mode toggle: **Act independently** / **Delegate to someone** / **Skip**.

When delegation is selected:
- A list of configured session participants appears (radio selection — one at a time)
- The following players are greyed out and unselectable:
  - Players already receiving delegation from someone else
  - Players who have themselves declared delegation (a delegating player cannot also be a delegation target — chain delegation is not supported)
- Player types a short description of what they're contributing
- Warning shown: "You cannot act independently this round once submitted"
- Roll formula preview: `D12 + [their modifier]`

### 6.2 Conflict Resolution — Simultaneous Delegation

Because Syncthing is not instantaneous, two players may submit delegation to the same target before either device has received the other's file. When the SGM console reads both action files:

- Compare `submittedAt` timestamps
- The earlier timestamp keeps the delegation (first-submitted wins)
- The later-submitting player's mode is automatically reverted to `"act"` with a conflict notice shown on their device: "Delegation to [Name] was already taken. Your action has been reset — please declare again."
- The SGM console also shows the conflict notification

### 6.3 Console Display

Once submitted, the delegating player appears as an indented sub-row under their target across all phases:

```
┌─ Georgi  "Check if the Azure account is still active..."  [DC: 14]  + Damian assisting
└↳ Damian  "Pulling API call logs..."                                    D12+3
```

The target player's device shows an incoming assist notification with the helper's description and updated roll formula.

### 6.4 Roll Calculation

- Delegating player rolls D12 (not D20)
- Result added directly and unconditionally to the primary actor's total (no separate DC check)
- A delegation D12 roll of 1 has no special mechanical effect — it is treated as a normal low result contributing 1 + modifier to the primary total (no critical failure)
- Combined total compared to DC as one roll

### 6.5 Coordination Cost

If the primary player meets the DC:
- The delegating player is automatically flagged as **must skip next round** (they cannot act or delegate)
- This flag is stored in the session config and shown on their "My Action" tab next round as: "You coordinated last round — skip required this round"

If the primary player fails to meet the DC:
- No coordination cost applies to the delegating player
- Both players' actions are consumed but neither is penalised into the following round

### 6.6 Special Rules in Delegation Context

| Special Rule | Delegating player | Target (primary) player |
|---|---|---|
| **Phone Call** | A player on a Phone Call round is treated as skipping — they cannot also delegate. Shown as ineligible in delegation target list. | A player using a Phone Call cannot receive delegation that round. |
| **C-Level Override** | Cannot be used while delegating (the override affects the player's own roll, which does not exist in delegation mode). | If the primary player invokes C-Level Override, the delegation bonus is still rolled and added (the override makes the base succeed; the bonus is irrelevant but not harmful). Auto-triggers D10 + D6 as normal. |
| **Security Cert Reroll** | Delegating player rolls D12, not D20 — the reroll does not apply (it is explicitly a D20 reroll). | Primary player can reroll their D20 as normal. The delegation D12 result from the helper is fixed (no reroll on D12). |
| **Going It Alone** | Not applicable — delegating player has no independent action. | If receiving delegation, the primary player is not acting alone — the +1 DC penalty does not apply. |

---

## 7. Automated Outcome Resolution

Outcome is determined by comparing total roll to DC, using the D20 Ruleset exactly:

| Condition | Outcome tier | Auto-triggered secondary roll |
|-----------|-------------|-------------------------------|
| Natural 1 (D20 = 1) | Critical Failure — always, regardless of modifiers | D4 collateral damage |
| Miss by 6+ | Critical Failure | D4 collateral damage |
| Miss by 3–5 | Failure | D6 time cost |
| Miss by 1–2 | Partial Failure — retry next round at −1 | None |
| Meet DC exactly | Bare Success | None (SGM discretion) |
| Exceed by 1–3 | Clean Success | None |
| Exceed by 4–6 | Strong Success | D8 information depth |
| Natural 20 (D20 = 20) | Critical Success — always, regardless of total | D8 information depth |

Natural 1 and Natural 20 are checked before modifier arithmetic.
A delegation D12 roll of 1 is not a Natural 1 — no special effect (see §6.4).

Secondary dice (D4, D6, D8) are rolled automatically and displayed alongside the outcome tier. Their results inform the SGM's narrative but are not binding.

### 7.1 Persistent Modifiers — Partial Failure Retry

When a player receives a Partial Failure outcome:
- A `retryPenalty: -1` modifier is stored in their action file for the next round
- Displayed in their "My Action" tab next round as: "Partial failure carry-over: −1 to this roll"
- The −1 is automatically included in their next roll calculation
- The modifier expires after one round regardless of whether the player acted (skipping a round does not preserve the −1 into the round after)
- Stored in the session config under `pendingModifiers: { "PlayerName": -1 }`

### 7.2 Special Rules Tracking

Tracked in the session config `specialRulesUsed` object. The console shows each special rule as a toggle (available / used) per eligible player. Once used, the toggle is disabled for the remainder of the session.

| Rule | Who | Limit | Effect |
|------|-----|-------|--------|
| Phone Call | Any player | Once per session | Costs one full round, no roll, no DC. SGM decides info available. Player shown as skipping in console. |
| C-Level Override | Thomas or Anja | Once per session | Auto-success on their action. Triggers D10 complication + D6 time cost automatically. |
| Security Cert Reroll | Eligible players | Once per session | Reroll one failed D20; must keep second result. Not available on D12 delegation rolls. |
| Going It Alone | Any player | Per action | SGM may add +1 DC when acting alone on DC ≥ 14. SGM toggles this manually in the DC phase. |

---

## 8. Bonus System

### 8.1 Data Source

Bonuses are read from each player's character `.md` file statblock fields at session start (when participants are selected in the session config). The bonus data is embedded in the saved session config so the console works offline from the character files during play.

```yaml
modifier: "+4"          # base role modifier — used for all rolls
bonus: "Azure +2"       # speciality bonus — shown as checkbox; comma-separated for multiple
special: "C-Level Override (once per session)"
delegation: "Roll D12 + 4 when assisting another player"
```

Where `bonus` contains multiple bonuses, it is parsed as a comma-separated list. Each entry becomes an independent checkbox.

Conditional modifiers (e.g. `C-Level: +3 Escalation`) are stored with a condition label and shown in the checkbox list with a note — the player ticks them only when the condition matches their declared action.

### 8.2 Checkbox Behaviour

- Pre-populated from character file at session configuration time
- Player ticks which bonuses apply to their current declared action
- Only ticked bonuses are included in the roll calculation
- Bonus state is saved in the action JSON (`bonuses[].active`)

---

## 9. Session Log Format

Each finalized round appends one block to the configured session output file:

```markdown
## Round N — YYYY-MM-DD HH:MM

---

**[Player Name]** · [Action text]
Roll: D20([n]) + [Role](+X) + [Bonus](+Y) + [delegation bonus: +Z] = **[Total]** vs DC [n]
*(Delegation from [Helper]: D12([n]) + [Helper Role](+X) = +Z — see [Helper]'s entry below)*
Outcome: [Tier] ([+/− margin]) · [Secondary dice result if any]
> "[SGM narrative reveal text]"

---

**[Delegating Player]** → assisting [Target]
D12([n]) + [Helper Role](+X) = **+[contribution]** contributed to [Target]'s total
[Coordination cost note: must skip Round N+1]

---

**[Skipping Player]** — passed this round

---

⚡ **SGM — Round N close:** "[Overall round narrative — optional]"

---
```

Notes on format:
- The D12 value appears once in the primary player's roll line as `[delegation bonus: +Z]` with a cross-reference note
- Full D12 breakdown appears only in the helper's own entry — no duplication of the raw number
- The SGM round close line is omitted from the log if the field was left blank
- Partial failure carry-over is noted on the affected player's next round entry as: `(−1 carry-over from partial failure)`

---

## 10. Remaining Work Items (separate implementation cycles)

### A. Code cleanup (no design needed — straightforward)
- Fix remaining `Creature`/`creature`/`monster`/`bestiary` string references in `ttx-round-tracker` source
- Rename plugin-internal folder path references from `creatures` to `participants`
- Check vault folder structure for any D&D-specific naming

### B. Syncthing configuration
- Per-device config (SGM template + player template)
- Conflict resolution: `submittedAt` timestamp in action JSON handles delegation conflicts; session log is SGM-only write so no conflict possible there
- Verify filesystem event behaviour on macOS (primary platform) before Game Day

### C. On-the-fly scenario generation
- After board game Phase 1, SGM uses the Hack-Attack collection sheet to select a scenario vector
- A Templater command generates a new scenario file pre-filled from the board game output
- Scenario grows during play: SGM fills phase outcomes, hidden complication, endpoint, debrief anchor

### D. Workspace JSON configuration
- Generate `workspaces.json` for the SecurityTTX vault with `SGM` and `Player` named workspaces
- Player workspace: four-tab layout (§4)
- SGM workspace: three-panel layout (§4)

---

## 11. Out of Scope

- Real-time WebSocket sync (Syncthing file-based sync is sufficient)
- Dice animation or visual effects
- Mobile-optimised layout (Obsidian mobile is a stretch goal, not required for Game Day)
- Automated scenario generation from AI (scenarios are SGM-authored)
- Any D&D-specific mechanics (CR, XP, HP, conditions lists)
- Multiple simultaneous delegations to the same target (one helper per primary per round)
