# Syncthing Setup — SGM Device

The SGM (Scenario Game Master) device is the **authoritative source** for the shared vault.
It syncs the vault to all player devices, but keeps GM-only folders private.

---

## Folder Structure in the Vault

```
SecurityTTX/                  ← vault root (shared folder in Syncthing)
├── 01 Characters/            ← shared → players see their own character sheets
├── 02 Resources/             ← shared → reference material for all
├── 03 Scenarios/             ← SGM only — NOT synced to players
├── 04 Sessions/              ← synced to players (Send Only from SGM)
├── 05 Actions/               ← synced to players (Send & Receive — players write here)
├── GM/                       ← SGM only — NOT synced to players
└── private/                  ← SGM only — NOT synced to players
```

---

## Syncthing Configuration

### 1. Add the Vault as a Shared Folder

In the Syncthing web UI (`http://localhost:8384`):

1. Click **Add Folder**
2. Set **Folder Path** to the full path of your `SecurityTTX/` vault
3. Set **Folder ID** — use a short memorable string, e.g. `ttx-vault`
4. Set **Folder Type** to **Send & Receive** *(default — SGM is the primary node)*

### 2. Ignore GM-Only Folders

Create or edit `.stignore` in the vault root. This file is **not synced** — each device maintains its own. On the SGM device you can leave it empty (no self-exclusions needed), but you must configure player devices to exclude the sensitive folders.

SGM `.stignore` (vault root):
```
# SGM device — no exclusions needed locally.
# Player devices exclude GM/, 03 Scenarios/, and private/.
```

### 3. Configure the Sessions Folder as Send Only

The SGM writes session JSON files to `04 Sessions/`. Players should receive these files but not be able to overwrite them.

**On the SGM device**, the main folder type is **Send & Receive** (default).

**On each player device**, you override this folder's type to **Receive Only** — see `player-device.md`.

> The sessions folder does not need its own separate Syncthing share.
> The vault-level share handles it; the per-device folder type controls write direction.

### 4. Share with Player Devices

For each player device that connects:

1. In Syncthing, go to the `ttx-vault` folder → **Edit → Sharing**
2. Add the player device by its **Device ID**
3. Leave the folder type as **Send & Receive** on the SGM side
4. The player must accept the share on their device and set it to **Receive Only** for session safety

### 5. Verify Sync is Working

After connecting a player device:

```
Syncthing UI → ttx-vault folder → should show "Up to Date" on both devices
```

Check that `04 Sessions/` files appear on the player device within a few seconds of the SGM creating them.

---

## Summary of Folder Types (SGM Device)

| Folder | Synced to Players | SGM Type | Player Type |
|--------|-------------------|----------|-------------|
| `01 Characters/` | Yes | Send & Receive | Receive Only |
| `02 Resources/` | Yes | Send & Receive | Receive Only |
| `03 Scenarios/` | **No** — excluded via player `.stignore` | — | — |
| `04 Sessions/` | Yes | Send & Receive | Receive Only |
| `05 Actions/` | Yes | Send & Receive | Send & Receive |
| `GM/` | **No** — excluded via player `.stignore` | — | — |
| `private/` | **No** — excluded via player `.stignore` | — | — |

---

## Notes

- The SGM device should remain **online and unlocked** for the duration of the session so Syncthing can push updates in real time.
- `05 Actions/` is the only folder where players **write** (their action JSON files). All others are read-only on player devices.
- If you use a laptop as the SGM device, disable sleep/lock during sessions to keep Syncthing active.
