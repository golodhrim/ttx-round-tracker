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
date_played:
participants: [Georgi, Michael, Damian, Andreas, Thomas, Anja]
---

# Scenario: <% scenarioName %>

> **CRM principle:** There is no win or loss. This scenario exists to create realistic pressure that surfaces team dynamics. The endpoint is a description of where the incident arrived — not a verdict.

```statblock
layout: TTX Scenario
name: "<% scenarioName %>"
attack_vector: "<% attackVector %>"
difficulty: "<% difficulty %>"
trigger: ""
attacker_goal: ""
phase1: ""
phase2: ""
phase3: ""
crm_focus: ""
hidden_complication: ""
```

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
