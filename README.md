> 📖 Documentation and landing page: **[ttx-plugins.golodhrim.de](https://ttx-plugins.golodhrim.de)** *(coming soon)*
>
> <a href='https://www.buymeacoffee.com/golodhrim' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi3.png?v=3' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>

---

# TTX Round Tracker

A round tracker plugin for **[Obsidian](https://obsidian.md)** designed for **Tabletop Cybersecurity Exercises (TTX)**. It helps facilitators (SGMs) and participants track initiative order, round flow, player actions, and session logs during live TTX game sessions.

This plugin is a fork of the [Initiative Tracker](https://github.com/valentine195/obsidian-initiative-tracker) by javalent, adapted and extended for the TTX ruleset.

## Features

### Round Tracker
- Add and remove participants from the round
- Input participant name and initiative score
- Sort participants by initiative automatically
- Track active statuses per participant
- Save and load encounters across sessions

### TTX Game Console
- **SGM Console**: Orchestrate rounds — declaration phase, DC setting, roll resolution, and reveal
- **Player Console**: Submit actions, delegate to teammates, track bonuses, view session log live
- **Delegation mechanic**: Players can assist others, adding their D12 + modifier to the target's roll
- **Special rules**: Phone Call, C-Level Override, Certification Reroll — tracked per session
- **Session log**: Auto-generated markdown log appended to a vault note after each round
- **Workspace presets**: SGM and Player workspaces pre-configured in `.obsidian/workspaces.json`

### Session Management
- Sessions stored as JSON in a configurable vault folder (`04 Sessions/` by default)
- Participants defined via YAML `statblock` blocks in character markdown files
- Per-player action files written to a shared folder (Syncthing-compatible)

## Tools We Are Using

*(section coming soon — will list Obsidian plugins, Syncthing, and other tools used in the TTX setup)*

## Quickstart

1. Install the plugin in Obsidian.
2. Open **Settings → TTX Round Tracker → TTX Game Console** and configure:
   - Toggle **SGM Mode** on the SGM device, off on player devices
   - Set the **Sessions Folder** path (default: `04 Sessions`)
3. Click the shield icon in the ribbon to open the TTX Console.
4. On the SGM device: create a new session, select participants, and start round tracking.
5. On player devices: join by opening the console — it detects today's session automatically.

For the classic initiative tracker (encounter blocks in notes), create a code block:

````yaml
```encounter
name: Example
participants:
 - Georgi
 - Damian
```
````

## Support

File issues or feature requests on the **[GitHub repository](https://github.com/golodhrim/ttx-round-tracker/issues)**.

## Related Plugins

- **[Dice Roller](https://github.com/valentine195/obsidian-dice-roller)** — Inline dice rolling for Obsidian
- **[Statblocks Plugin](https://github.com/valentine195/obsidian-5e-statblocks)** — Character stat block formatting in Obsidian
