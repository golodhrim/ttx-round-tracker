<%*
const attackVector = await tp.system.prompt("Attack vector (from Hack-Attack collection sheet)");
const scenarioName = await tp.system.prompt("Scenario name (short, used in filename)");
const difficulty = await tp.system.suggester(
    ["Easy (DC 8–12)", "Medium (DC 13–17)", "Hard (DC 18–22)"],
    ["easy", "medium", "hard"]
);
const date = tp.date.now("YYYY-MM-DD");
const slug = scenarioName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const fileName = `${date}-${slug}`;

await tp.file.rename(fileName);
await tp.file.move(`03 Scenarios/${fileName}`);
_%>
---
tags: [scenario]
attack_vector: <% attackVector %>
difficulty: <% difficulty %>
date_played:
participants: [Georgi, Michael, Damian, Andreas, Thomas, Anja]
crm_focus:
---

# Scenario: <% scenarioName %>

> **CRM principle:** There is no win or loss. This scenario exists to create realistic pressure that surfaces team dynamics. The endpoint is a description of where the incident arrived — not a verdict.

**Attack vector:** <% attackVector %>
**Difficulty:** <% difficulty %>
**SGM:** Martin Scholz

---

## Scenario Brief (SGM eyes only — share trigger only with players)

| Field | Value |
|-------|-------|
| **Vector** | <% attackVector %> |
| **Trigger** | *(How players first notice something is wrong — share this)* |
| **Attacker goal** | *(What the attacker is trying to achieve)* |
| **Real-world impact** | *(Data loss / downtime / regulatory / reputational)* |

---

## Phase Structure

### Phase 1 — Discovery

**Objective:** Team identifies that an incident is occurring and begins to understand its nature.

| Element | Detail |
|---------|--------|
| DC range | |
| Clues available | |
| Information the SGM drip-feeds | |
| CRM tension to create | |

### Phase 2 — Containment

**Objective:** Team takes action to stop the spread and limit damage.

| Element | Detail |
|---------|--------|
| DC range | |
| Key decision point | |
| Escalation pressure | |
| CRM tension to create | |

### Phase 3 — Recovery

**Objective:** Team restores normal operations and addresses root cause.

| Element | Detail |
|---------|--------|
| DC range | |
| Trade-offs required | |
| External dependencies | |
| CRM tension to create | |

---

## Hidden Complication

*(Something the SGM introduces mid-game to increase realism — reveal at the right moment)*

---

## CRM Observation Plan

*What the SGM specifically wants to observe and learn from this scenario:*

- **Communication dynamic to watch:**
- **Resource use to observe:**
- **Escalation moment to set up:**
- **Error chain to let develop:**
- **Stress trigger:**

---

## Scenario Endpoint

*Neutral description of where the incident ends — written after the session based on the team's decisions.*

---

## Debrief Anchor

*The one moment or decision the SGM brings into the debrief to open the discussion:*

---

## After-Action Notes

*(Fill in after the session)*

**What the team did that was unexpected:**

**Communication patterns observed:**

**Resource use patterns observed:**

**Error chains that developed:**

**What to adjust in the scenario for next time:**
