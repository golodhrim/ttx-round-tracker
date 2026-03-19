# Syncthing Setup — Player Device

Player devices **receive** the vault from the SGM device. They get character sheets, resources, and live session files, but not GM-only content. The only folder players write to is `05 Actions/` (their action JSON files).

---

## Prerequisites

- Syncthing installed on the player's machine (desktop or laptop)
- The SGM device is online and has added this device via its Device ID

---

## Setup Steps

### 1. Install Syncthing

Download from [https://syncthing.net/downloads/](https://syncthing.net/downloads/) and start it.
The web UI is available at `http://localhost:8384`.

### 2. Share Your Device ID with the SGM

In the Syncthing web UI:

1. Click **Actions → Show ID** (top right)
2. Send the displayed **Device ID** to the SGM operator
3. The SGM will add your device to the `ttx-vault` share

### 3. Accept the Share Request

Once the SGM has added your device, Syncthing will show a notification:

> *"Device [SGM-device-id] wants to share folder 'ttx-vault'"*

Click **Add** and:

- Set **Folder Path** to where you want the vault on your machine (e.g. `~/Documents/SecurityTTX`)
- Set **Folder Type** to **Receive Only**

> **Important:** Receive Only means you cannot accidentally overwrite SGM files.
> The exception is `05 Actions/` — see step 5 below.

### 4. Configure `.stignore` to Exclude GM-Only Folders

Create a file named `.stignore` in the vault root on your device.
This prevents GM-only folders from syncing to you even if the SGM accidentally shares them.

```
# Player device — exclude SGM-only content
GM
03 Scenarios
private
```

> Syncthing reads `.stignore` automatically. No restart needed after saving.

### 5. Enable Write Access for the Actions Folder

The `05 Actions/` folder is where you write your action JSON files. The vault-level **Receive Only** setting would block this, so you need to override it.

**Option A — Separate Syncthing Share (recommended):**

Ask the SGM to also share `05 Actions/` as a **separate folder** in Syncthing with a different Folder ID (e.g. `ttx-actions`). Then:

- Accept this share separately
- Set its type to **Send & Receive**
- Point it to `<vault-root>/05 Actions/`

This gives you read/write on actions while keeping the rest of the vault read-only.

**Option B — Single share, Send & Receive (simpler, less safe):**

Set the whole vault to **Send & Receive**. The `.stignore` still protects GM folders. Risk: a misconfigured client could overwrite session files. Only use this option if you trust all player devices.

---

## Verify the Setup

After accepting the share and saving `.stignore`:

1. Wait for initial sync to complete (Syncthing UI shows "Up to Date")
2. Confirm these folders exist locally:
   - `01 Characters/`
   - `02 Resources/`
   - `04 Sessions/`
   - `05 Actions/`
3. Confirm these folders do **not** exist locally:
   - `03 Scenarios/`
   - `GM/`
   - `private/`
4. Open Obsidian, set the vault path to your local `SecurityTTX/` folder
5. Install the TTX Round Tracker plugin and open the TTX Console — it should detect today's session automatically

---

## Summary of Folder Access (Player Device)

| Folder | Received | Can Write | Notes |
|--------|----------|-----------|-------|
| `01 Characters/` | Yes | No | Read-only — character sheets |
| `02 Resources/` | Yes | No | Read-only — reference material |
| `03 Scenarios/` | **No** | No | Excluded via `.stignore` |
| `04 Sessions/` | Yes | No | Read-only — SGM writes these |
| `05 Actions/` | Yes | **Yes** | Write your action files here |
| `GM/` | **No** | No | Excluded via `.stignore` |
| `private/` | **No** | No | Excluded via `.stignore` |

---

## Troubleshooting

**Sync not starting:** Make sure the SGM device is online and reachable on the same network (or via relay).

**GM folders appearing:** Check `.stignore` is saved in the vault root (not a subfolder) and uses plain folder names without trailing slashes.

**Action files not reaching the SGM:** Confirm the `05 Actions/` folder is Send & Receive (Option A above), not Receive Only.

**Session log not updating in Obsidian:** The TTX Console reads the log file via Obsidian's vault API, which picks up filesystem changes automatically. If it's not refreshing, check that Syncthing has finished syncing (`Up to Date` in the UI).
