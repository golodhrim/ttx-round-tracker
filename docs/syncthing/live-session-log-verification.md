# Verification — Live Session Log Updates on macOS

The TTX Console's Session Log tab uses Obsidian's `vault.on('modify')` event to refresh the log
display whenever the session log file changes on disk. This relies on macOS filesystem events
(FSEvents) propagating through Syncthing to Obsidian in real time.

This document describes how to verify the full chain works before a live session.

---

## What We Are Testing

```
SGM device writes round result
  → appends to session log .md file
    → Syncthing picks up the change (FSEvents → inotify/FSEvents)
      → Syncthing pushes to player device
        → Syncthing writes updated file to player vault folder
          → macOS FSEvents fires on player device
            → Obsidian vault detects file change
              → vault.on('modify') fires in TTX Console
                → Session Log tab re-reads and displays updated content
```

Every link in this chain must work for live updates to feel instant.

---

## Prerequisites

- SGM device and at least one player device both running Syncthing, connected, and showing "Up to Date" for the vault folder
- Both devices have Obsidian open with the TTX Round Tracker plugin loaded
- A session has been created on the SGM device (so the session log file exists)
- The player has the TTX Console open on the **Session Log** tab

---

## Verification Steps

### Step 1 — Confirm Syncthing is Active on Both Devices

On both devices, open `http://localhost:8384` in a browser.

Expected: Both devices show the `ttx-vault` folder as **Up to Date** and the SGM device appears as a connected remote device.

---

### Step 2 — Check Obsidian File Watch is Working (Player Device)

On the player device:

1. Open the vault in Finder
2. Open the session log file (e.g. `04 Sessions/2026-03-19-session.md`) in a plain text editor (TextEdit, VS Code, etc.)
3. Add a line of text and save
4. Switch back to Obsidian — the file should reload within 1–2 seconds

Expected: Obsidian picks up the external change and the Session Log tab reflects it.

> If Obsidian does not pick up the change, check **Settings → Files & Links → Detect all file extensions** is enabled.

---

### Step 3 — Check Syncthing Propagation Speed

On the SGM device, manually append a line to the session log file from the terminal:

```bash
echo "\n## Test round" >> "/path/to/vault/04 Sessions/2026-03-19-session.md"
```

On the player device, watch the Syncthing UI — the folder should briefly show "Syncing" then return to "Up to Date".

Expected: The file change propagates to the player device within 2–5 seconds on a local network.

---

### Step 4 — End-to-End Test via the SGM Console

1. SGM: Open the TTX Console, start or resume today's session
2. Player: Open the TTX Console, navigate to the **Session Log** tab
3. SGM: Complete a round (declare → set DC → roll → reveal → finalize)
4. Watch the player's Session Log tab

Expected: Within a few seconds of the SGM finalizing the round, the new round block appears in the player's Session Log tab without any manual refresh.

---

## Timing Expectations

| Leg | Expected Latency |
|-----|-----------------|
| SGM writes file | < 100 ms |
| Syncthing detects change (FSEvents) | < 1 s |
| Syncthing transfers to player (local network) | 1–3 s |
| Obsidian detects file change on player | < 1 s |
| Session Log tab updates | < 100 ms |
| **Total end-to-end** | **2–5 s** |

This is acceptable for a TTX session where rounds take several minutes.

---

## Known Failure Modes

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Player Session Log never updates | Obsidian not watching the file | Restart Obsidian; check Files & Links settings |
| Long delay (> 30 s) before update | Syncthing using relay instead of direct connection | Ensure both devices are on the same LAN; check Syncthing connection type shows "Direct" |
| Occasional missed update | Syncthing conflict or rate limiting | Check Syncthing UI for conflict files; delete `.sync-conflict-*` files if present |
| Update appears then disappears | Player device is Send & Receive and overwrote the file | Set player vault folder type to Receive Only (except 05 Actions/) |

---

## Live Test Sign-Off Checklist

Run through these before the first real TTX session:

- [ ] Step 1: Both devices show "Up to Date" in Syncthing
- [ ] Step 2: Obsidian on player device picks up external file edits within 2 s
- [ ] Step 3: A terminal-appended line propagates to the player within 5 s
- [ ] Step 4: A full SGM round finalization appears in the player Session Log tab
- [ ] Syncthing shows "Direct" connection (not relay) between devices
- [ ] No `.sync-conflict-*` files exist in `04 Sessions/`
