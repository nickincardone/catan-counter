# How tracking works

## Known cards and possible hands

The tracker turns observed game messages into resource transactions: production, trades, builds, development-card effects, steals, and discards.

When a steal hides the resource, the variant system branches into possible hands. Each branch carries a probability. Later observations remove branches that cannot explain what happened—for example, a player spending resources they would not have in that branch.

The hands display distinguishes guaranteed cards from probable additional holdings. Probabilities describe the tracker's surviving possibilities, not privileged knowledge of another player's hand. Missing observations and unsupported protocol changes can affect accuracy.

### Resolving a steal

If you learn what was stolen, selecting that resource constrains the possibilities. Undo rebuilds state from the game's transaction history and reapplies the resolutions still in effect, rather than trying to reverse only the latest arithmetic.

### Exact and approximate refinements

[`src/trackerConfig.ts`](../src/trackerConfig.ts) controls optional approximate refinements. They are disabled by default. When enabled, the tracker may cull low-probability branches and automatically resolve sufficiently likely outcomes. Check the source for the thresholds; these are implementation settings, not UI preferences.

If every branch contradicts an observed transaction, the tracker warns and force-applies it with clamping rather than leaving an empty variant tree. This keeps tracking running but cannot restore missing information.

## Card flow

Card flow counts cards moving in and out, even when a resource type is unknown. The compact view shows:

| Column | Meaning                                                 |
| :----- | :------------------------------------------------------ |
| GOT    | Cards collected through production, trades, and steals. |
| ROBD   | Cards lost to steals and monopolies.                    |
| 7s     | Cards discarded on sevens.                              |

The extended view also exposes development-card gains, spending, and the resulting hand total:

```text
GOT + DEV - ROBD - 7s - SPENT = HAND
```

The full ledger breaks those totals down by source. A monopoly's total haul is observed, but its split across victims is inferred from their tracked hands. Treat that per-victim attribution as an estimate.

## Dice, development cards, and blocked production

- **Dice** counts observed rolls from 2 to 12. The reference tick shows the expected frequency for two fair six-sided dice; it is not a prediction of the next roll.
- **Dev deck** combines the remaining deck total with per-type cards not yet played and attribution for revealed cards. Unplayed cards are not necessarily still in the deck: some may be held by players.
- **Blocked by robber** groups observed denied production by dice number and resource type.

The standard resource supply and development-card composition are based on the base game. Do not assume expansion support.

[Documentation](README.md) · [Architecture](architecture.md)
