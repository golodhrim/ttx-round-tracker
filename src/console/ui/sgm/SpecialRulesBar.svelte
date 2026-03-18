<!-- src/console/ui/sgm/SpecialRulesBar.svelte -->
<script lang="ts">
    import type { SessionConfig } from "../../console.types";
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
            {#each config.participants as p}
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

<style>
    .special-rules { display: flex; gap: 0.75rem; padding: 4px 8px; background: var(--background-secondary); border-bottom: 1px solid var(--background-modifier-border); font-size: var(--font-smallest); flex-wrap: wrap; }
    .rule-group { display: flex; align-items: center; gap: 4px; }
    .rule-name { color: var(--text-muted); }
    .player-tag { background: var(--background-modifier-hover); border-radius: 10px; padding: 1px 6px; cursor: pointer; }
    .player-tag.used { opacity: 0.35; text-decoration: line-through; }
</style>
