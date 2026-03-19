# Vault Templates

These files are the canonical versions of the TTX vault template documents.
They are versioned here alongside the plugin so changes can be tracked in git.

## Files

### `Scenario-Template.md`
**Vault location:** `03 Scenarios/Scenario-Template.md`

The base template for all TTX scenarios. Contains frontmatter fields for
Templater to fill in, a scenario brief, three-phase structure (Discovery /
Containment / Recovery), CRM observation plan, hidden complication slot,
and after-action notes.

Use this as the starting point when the Templater command generates a new
dated scenario file from the selected attack vector.

### `Hack-Attack-Collection-Template.md`
**Vault location:** `05 Board-Game/Hack-Attack-Collection-Template.md`

Filled in by the Monitor during the board game phase. Records attack vectors
raised in each round, notable discussion points, per-round strongest vector
assessment, a consolidated shortlist, and the participant vote result.

The SGM reads the selected attack vector from this sheet and enters it into
the Templater prompt to generate a dated scenario file.

## Keeping Templates in Sync

If you update a template in the vault, copy the updated version back here:

```bash
cp "/path/to/SecurityTTX/03 Scenarios/Scenario-Template.md" \
   docs/vault-templates/Scenario-Template.md

cp "/path/to/SecurityTTX/05 Board-Game/Hack-Attack-Collection-Template.md" \
   docs/vault-templates/Hack-Attack-Collection-Template.md
```
