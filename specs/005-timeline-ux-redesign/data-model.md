# Data Model: Timeline UX Redesign

Entities from [spec.md](./spec.md) → Key Entities, with the design from [research.md](./research.md). Saved-state changes are additive and listed in [contracts/project-state-delta.ts](./contracts/project-state-delta.ts).

## Item (clip) — `src/timeline/model/item.ts` (changed)

| Field | Type | Saved | Change | Notes |
|---|---|---|---|---|
| `id` | `string` | yes | — | |
| `trackId` | `string` | yes | — | |
| `start`, `end` | `number` (ticks) | yes | — | `start ≥ 0`, `end > start` |
| `resizable` | `boolean` | yes | — | `false` for audio |
| `libraryItem` | `LibraryItem` | id | — | Several clips may share one item (linked) |
| `target` | `ClipTarget = Target \| "inherit" \| null` | yes | **changed** | `null` = none. New clips: `"inherit"` (R3). Only used by Look/Effect/Graph clips |
| `fadeIn`, `fadeOut` | `number` (ticks, ≥ 0) | yes | — | Look/Effect only; clamped by `clampFades` |
| `selected` | — | — | **removed** | Moves to the selection in the store (R2) |

**Validation and rules**:
- `effectiveTarget(item)` = `item.target === "inherit" ? track(item.trackId).defaultTarget : item.target`.
- No new edit may produce two clips on the same track with `max(startA, startB) < min(endA, endB)` (FR-044). Touching is allowed.
- Load: `target` → `Target` if valid, `"inherit"` if the string `"inherit"`, otherwise `null`.

## Track — `src/timeline/model/track.ts` (unchanged fields)

| Field | Type | Saved | Notes |
|---|---|---|---|
| `id`, `name`, `height`, `removable`, `data` | — | yes | unchanged |
| `defaultTarget` | `Target \| null` | yes | Meaning changes: applied **live** to clips whose target is `"inherit"` (FR-019). Tracks cannot inherit (spec assumption) |

## Selection — timeline store (new, not saved)

| Field | Type | Notes |
|---|---|---|
| `selectedIds` | `Set<string>` | Ids of selected clips; removed clips are dropped |
| `anchorId` | `string \| null` | Last clicked clip; anchor for Shift+click ranges on the same track |

Operations: `select(ids, mode: "replace" | "add" | "toggle")`, `selectRange(toId)`, `selectAll()`, `clearSelection()`, `isSelected(id)`, `selectedItems` (computed).

## Clipboard — timeline store (new, not saved)

```text
Clipboard {
  entries: Array<{
    state: IItemState   // full clip state incl. libraryItemId, target, fades
    dt: number          // start − earliest start of the copied set
    dTrack: number      // track index − topmost track index of the copied set
  }>
}
```

Cleared on project `load()`/`reset()`. Paste creates new ids. Entries whose library item no longer exists are skipped.

## Undo history — `src/timeline/model/history.ts` (new, not saved)

```text
TimelineSnapshot = { tracks: ITrackState[]; items: IItemState[] }   // no unitWidth/headerWidth

TimelineHistory {
  undoStack: Array<{ label: string; snapshot: TimelineSnapshot }>   // max 100
  redoStack: Array<{ label: string; snapshot: TimelineSnapshot }>
  pending: TimelineSnapshot | null                                  // open gesture
}
```

State transitions:
- `edit(label, fn)`: `s = snapshot()`, run `fn`, if `snapshot() ≠ s` → push `s` on undo, clear redo.
- `beginGesture()` → `pending = snapshot()`. `endGesture(label)` → if changed, push `pending` and clear redo. `pending = null`.
- `undo()`: push the current snapshot on redo, pop undo, reconcile. `redo()` is the mirror image.
- `clear()` on `load()`/`reset()`.

**Reconcile(target)**:
- update tracks by id and restore their order
- update items by id (`move(start, end, true)`, then `trackId`, `target`, fades, `resizable`, `libraryItem`)
- create missing items and drop extra ones
- skip items whose library item is gone
- recompute audio lengths from the current BPM
- prune the selection to ids that still exist

## Clip layout — derived (not saved)

| Layout | On-screen width | Shows |
|---|---|---|
| wide | ≥ 120 px | name + warning, target chip, summary line, full-width preview |
| medium | 40–120 px | name, target chip |
| narrow | < 40 px | colour bar + first letter (minimum 4 px visual width) |

Target colour: `targetColor(effectiveTarget)` → `hsl(hash(kind+id) mod 360, 65 %, 55 %)`. No effective target on a targetable clip → hatched background and warning icon.

## View state — timeline store (not saved unless noted)

| Field | Type | Saved | Notes |
|---|---|---|---|
| `unitWidth` | `number` | yes (existing) | Clamped 0.05–50 |
| `followPlayhead` | `boolean` | no | Off by default; turned off by manual scrolling during playback |
| `hoveredTrackId` | `string \| null` | no | Paste base track (moved from component state into the store) |
