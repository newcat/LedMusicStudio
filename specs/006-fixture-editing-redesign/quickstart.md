# Quickstart: Fixture Editing Redesign

**Feature**: 006-fixture-editing-redesign

How to check that the feature works end to end. The full manual verification procedure is in [spec.md → Manual Verification](./spec.md#manual-verification); contracts: [fixture-commands.md](./contracts/fixture-commands.md), [inspector-ui.md](./contracts/inspector-ui.md).

## Prerequisites

- `pnpm install`
- Browser target: `pnpm dev` → http://localhost:3000, window 1600 × 900.
- Desktop target: `pnpm electron:dev`.
- A stage file saved **before** this feature for the migration check (e.g. export one from `main` before merging: one DMX fixture without visualization, one linked moving head, one LED strip drawn with "Draw LED strip", one dropped "Par can" model). Keep it as `old-stage.lms` outside the repo.

## Quality gates

```sh
pnpm lint
pnpm build        # includes vue-tsc --noEmit
```

Both must pass (constitution II).

## Smoke scenarios

| # | Do | Expect |
|---|---|---|
| 1 | Stage view | Tabs: Controllers, Visualization (active), Groups; Import/Export at the right, not next to the tabs |
| 2 | Add → DMX fixture, pick "Robe / ColorSpot 2500E AT" | Fixture selected; type Moving Head, matching model, Channel mapping "x / 24" already filled (research R8) |
| 3 | Address 20 with another 24-channel fixture at 1 on the same controller | Hint "20–43", warning names the other fixture |
| 4 | Ctrl+D, then Delete, then Ctrl+Z | Copy "… 2" on same controller; delete removes it from Controllers tab; undo brings it back with group membership |
| 5 | Change mode, LED count, controller, a default; Ctrl+Z each | Each reverts in one step |
| 6 | Draw LED strip, 4 m | LED strip fixture with 120 LEDs |
| 7 | Drag inspector to its minimum, select moving head, open all sections, expand a capability | No horizontal scrollbar; ranges open in a dialog |
| 8 | Collapse Transform, select another object, reload | Transform still collapsed |
| 9 | Import `old-stage.lms` | "Unplaced fixtures" group with the fixture; dropped Par can and strip have fixtures; toast summarises; Ctrl+Z does nothing |
| 10 | Export, re-import | No toast, nothing changes |
| 11 | Toolbar at 1600 px | One row; Grid/Axes/Labels in Display popover; Focus in View menu |
| 12 | Groups: select two fixtures in the scene, "Add selected fixtures"; Controllers: click a controlled fixture | Members added; Visualization tab opens with that fixture selected and framed |

## Invariant check (dev console)

`window.stage` is exposed by `App.vue`. After any of the scenarios above, this should print `true`:

```js
(() => {
  const ids = [...stage.fixtures.keys()];
  const links = stage.visualization.controllers; // one entry per linked fixture object
  return ids.length === links.size;
})();
```
