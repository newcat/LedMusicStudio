# Research: Timeline UX Redesign

Decisions for the open design questions of [spec.md](./spec.md). Each entry: decision, rationale, alternatives considered. All findings come from reading the current code (`src/timeline`, `src/programming`, `src/library`, `src/scene/model/history.ts`).

## R1 — Undo/redo: whole-timeline snapshots, restored by reconciling

**Decision**: a small `TimelineHistory` class in `src/timeline/model/history.ts` keeps an undo and a redo stack of **snapshots** of the timeline content (`tracks` + `items` as saved state, without `unitWidth`/`headerWidth`). Edits run through two store functions:

- `edit(label, fn)`: takes a snapshot, runs `fn`, and pushes the snapshot if the content changed (JSON comparison). Used for discrete edits (delete, paste, inspector changes, nudge, track changes, …).
- `beginGesture()` / `endGesture(label)`: for drags (move, resize, fade drag). The snapshot is taken at the start and pushed at the end if something changed. One drag = one step (FR-003).

Undo/redo pushes the current snapshot on the opposite stack and **reconciles** the store to the target snapshot by id: existing `Item`/`Track` objects are updated in place (`item.move(start, end, true)` so the audio processor re-registers buffers, then `trackId`, `target`, fades, `libraryItem`), missing ones are created, extra ones are removed. Object identity is kept, so the timeline processor's active-item tracking and audio subscriptions keep working. Limit: 100 entries (FR-004); cleared on `load()`/`reset()`.

Details:
- Items whose library item no longer exists are skipped on restore (spec edge case).
- Audio item lengths are recomputed from the current BPM on restore, because BPM changes are not part of the history and would otherwise restore stale lengths.
- Changes made outside the history (BPM-driven audio resize, clips removed because their library item was deleted) are not recorded. That is acceptable for a timeline-only history.

**Rationale**: "whatever is easier" was the user's choice. Snapshot + reconcile needs no per-command inverse logic: every current and future edit becomes undoable by wrapping it in `edit()`. Size is uncritical: 500 clips × ~250 bytes × 100 entries ≈ 12 MB worst case, typically far less.

**Alternatives considered**:
- Command pattern with inverse operations per edit: more code for every edit type, easy to get wrong for multi-clip edits.
- Reusing the scene editor's `SceneHistory` (per-object before/after diffs with merge windows): designed for scene objects; adapting it to items and tracks costs more than a 60-line snapshot stack.
- A global history across scene, library and timeline: much larger scope, not needed (spec assumption).

## R2 — Selection lives in the store, `item.selected` is removed

**Decision**: the timeline store gets `selectedIds: Set<string>` (reactive) and `anchorId: string | null` (last clicked clip, for Shift+click ranges), with helpers `select(ids, mode)`, `isSelected(id)`, `selectedItems`, `clearSelection()`. `Item.selected` is removed. Its readers (`Timeline.vue`, `TimelineItem.vue`, `programming/editorContext.ts`) switch to the store. Removed items are dropped from the selection.

**Rationale**: one source of truth for drag, clipboard, inspector, nudge and delete (FR-001). The selection is not saved, and a set of ids survives undo reconciliation without any extra work.

**Alternatives considered**: keeping `item.selected` flags: every consumer has to filter all items, and undo restores would have to preserve the flags.

## R3 — Clip target: `"inherit"` as a third value of `item.target`

**Decision**: `Item.target` becomes `ClipTarget = Target | "inherit" | null`, where `null` means "none". New clips get `"inherit"`. A new function `effectiveTarget(item)` in `src/programming/targets.ts` returns `item.target === "inherit" ? track.defaultTarget : item.target`, looking up the track in the timeline store. Every reader of `item.target` switches to it:

- `programming/processor.ts` (effects, looks, `attributeOutputTarget` for graphs)
- `timeline/baseTimelineProcessor.ts` (per-fixture graph runs, via `attributeOutputTarget`)
- `programming/uses.ts` (group use count; counts explicit targets, and tracks as today)
- `programming/editorContext.ts`
- `LookPreview` / `EffectPreview` (replaced by the new clip layout)

**Saved state**: `IItemState.target` is saved as a `Target`, the string `"inherit"`, or `null`. On load: a valid target becomes an explicit target, `"inherit"` becomes inherit, and anything else becomes `null` (none). Projects from before this feature always wrote `target` (as `Target` or `null`), so they load as explicit or none and play back unchanged (FR-020, SC-005). No version field is needed.

Changing the type to a union makes the compiler find every place that assumed `Target | null`.

**Alternatives considered**:
- A separate `inheritTarget: boolean` next to `target`: two fields that can contradict each other.
- Resolving inheritance when the track changes (copying the target into clips): this is the current behaviour the user wants to replace.

## R4 — Target colours: hashed hue per group/fixture id

**Decision**: `targetColor(target)` in `src/programming/targetColors.ts` hashes `kind + id` (FNV-1a) to a hue, with fixed saturation and lightness chosen to read on the dark theme (e.g. `hsl(h 65% 55%)`). Groups and fixtures with the same id hash never collide in practice. The colour shows as a 4 px left edge bar plus a 12 % tint of the clip body. "No effective target" on a targetable clip shows a CSS diagonal hatching (`repeating-linear-gradient`) and the existing warning icon.

**Rationale**: stable across sessions without new saved state (FR-028; groups have no colour property). Pure function, cheap.

**Alternatives considered**: a colour property on groups: needs UI and saved state; out of scope (spec assumption). A palette indexed by group order: colours would change when groups are reordered or deleted.

## R5 — Split at playhead: removed

**Decision**: no split feature. Removed by the user during planning ("adds too much complexity compared to its usefulness").

**Background**: every clip type plays its content relative to the clip start (`unit - item.start`): effects (phase), looks (fades), graphs (keyframes), automations and patterns. A correct split would need a new source-offset field on clips. That field would have to go through five playback call sites and four previews. Without it, the second part would restart its content. No `offset` field is added, and playback code is unchanged apart from target resolution (R3).

## R6 — Overlap prevention: nearest allowed delta

**Decision**: a pure module `src/timeline/model/placement.ts`:

- `allowedDelta(moving, statics, candidateDelta, trackOf)`: for a group of moving clips (with their destination tracks), each static clip on a destination track forbids the open interval `(staticStart − movingEnd, staticEnd − movingStart)` of deltas. A delta that would make a start negative is also forbidden. The function returns the allowed delta closest to the candidate, preferring the side towards the origin when there is a tie, or `null` if none is reachable. Touching (`end == start`) is allowed (FR-044).
- Drag: applied on every mouse move. The selection sits flush against an obstacle while the mouse is over it and jumps past once there is room on the other side, which is how DAWs behave.
- Nudge, paste, duplicate and Alt+drag use the same function. Up/Down nudge and paste reject (no change) when the result is `null`.
- Resize: `clampResize(item, newStart|newEnd, neighbours)` clamps the edge to the nearest neighbour on the same track.
- Drop from the library keeps today's free-track search, with the overlap test changed from `<=` to `<` so touching counts as free (FR-045).
- Static clips that already overlap each other (old projects) are ignored. Only moving-vs-static pairs are checked.

**Rationale**: one small pure function covers every editing path, with predictable "stop against neighbour" behaviour and no rejections during drags.

**Alternatives considered**: rejecting any colliding drag position (the clip gets stuck behind the mouse); pushing neighbours aside (that is ripple editing, which is out of scope).

## R7 — Snapping: grid snap on the dragged clip, magnetic edges, Alt disables

**Decision**:
- Grid: snap the **dragged clip's** new start (`snap(dragItem.start + diff)`) and apply the resulting delta to the whole selection. Today each clip is snapped individually, which distorts the spacing of clips that are not on the grid.
- Magnetic: candidate points are the start and end of every non-moving clip and the playhead. For each moving clip edge, the nearest candidate within `8 px / unitWidth` units wins, and the overall smallest distance decides the delta. Magnetic snapping takes precedence over the grid when it is within the threshold. Resize uses the same candidates for the dragged edge.
- Alt held during the gesture: no grid, no magnetic snapping (raw ticks). Alt at drag start on a clip centre also means copy (FR-015). The fade drag keeps Shift = no snap for consistency with feature 004, and Alt works there too.
- Electron/Windows: an Alt press can focus the menu bar. The timeline's keydown handler calls `preventDefault()` on `Alt` while a gesture is active or the timeline has focus.

## R8 — Keyboard handling

**Decision**: one `useTimelineShortcuts` composable bound to the timeline root (`tabindex="-1"`, focused on mousedown). It handles: Delete/Backspace, Ctrl+A, Esc, Ctrl+C/X/V/D, Ctrl+Z/Y, Ctrl+Shift+Z, arrows (±Shift) and Space.

- It returns early (no `preventDefault`) when the event target is an `input`, `textarea`, `select` or `[contenteditable]`, or sits inside a PrimeVue overlay (FR-005).
- It calls `preventDefault()` only for keys it handled.
- `Cmd` counts as `Ctrl` on macOS (`ev.ctrlKey || ev.metaKey`).
- The `ctrlPressed` ref is removed. Modifiers are read from the mouse event (`ev.ctrlKey`, `ev.shiftKey`, `ev.altKey`), which also fixes stale state when the key is released outside the window.

Shortcuts are only active while the timeline has focus, so they never conflict with the scene editor's own undo or with the editor pane above.

## R9 — Box select: computed from geometry, not DOM hit tests

**Decision**: mousedown on empty `.item-container` space (target is not inside `.timeline-item`) starts a rectangle in content coordinates. The rectangle is drawn as an absolutely positioned div in `.content`. Hit testing is pure math:

- x converts to a time range via `unitWidth` and `headerWidth`
- y converts to a track index range via the row height (`--rowHeight`, 100 px) and the 40 px header row
- a clip is hit when its track is in the range and its time range intersects

The selection updates live during the drag. Shift adds to the selection present at drag start, Ctrl toggles against it, and no modifier replaces it. A mouseup without movement (< 3 px) clears the selection (FR-009).

Mouse move and mouseup are window listeners during the gesture, so leaving the panel does not lose the drag. The same applies to clip drags, which today rely on track `mousemove` events and break when the mouse leaves the tracks.

## R10 — Clipboard

**Decision**: the clipboard is held in the timeline store, outside the history: `{ entries: Array<{ state: IItemState; dt: number; dTrack: number }> }`. `dt` is relative to the earliest start and `dTrack` relative to the topmost track index. It is not the system clipboard, because cross-project paste is out of scope. It is cleared on `load()`/`reset()`.

Paste:
- base tick = playhead
- base track = hovered track, otherwise the topmost track of the original selection, otherwise track 0
- tracks are created as needed (FR-013)
- new ids; library items are looked up by id and entries whose item is gone are skipped
- placement via R6 as one group (the whole paste shifts to the nearest allowed delta)
- all of this runs inside `edit("Paste")`

Ctrl+D: base tick = selection end, same tracks. Alt+drag: on drag start, clone the selection in place (inside the gesture) and drag the clones.

**Make unique**: `library.duplicateItem` is changed to return the new item and to name it `"<name> (copy)"`. Clips that share a library item share one new copy (FR-017). The clip re-pointing is undoable, but the duplicated library item stays in the library after undo, because library changes are outside the timeline history. `createItemByType` lacks `SCRIPT`: duplicating a script fails today. Make unique is therefore disabled for script clips, and the missing case is noted as a separate fix.

## R11 — Wheel, zoom to fit, follow, auto-scroll

**Decision**:
- `wheel`: with Ctrl or Meta, zoom (today's anchor math, with `ev.clientX` instead of `ev.screenX`, which is wrong on multi-monitor setups) and `preventDefault`, which also stops browser page zoom. Otherwise the handler does nothing and lets the native scroll happen: vertical, and horizontal with Shift in Chromium/Electron (FR-035). Zoom is clamped to a sane range (e.g. 0.05–50 px per tick).
- Zoom to fit: `unitWidth = (viewWidth − headerWidth − 20) / max(lastItemEnd, 4 bars)`, `scrollLeft = 0`.
- Follow playhead (toggle in the toolbar, off by default): during playback, when the playhead passes 90 % of the visible time range, scroll so it sits at 10 % (page-wise; continuous scrolling burns CPU and is hard to read). A `wheel`, scrollbar `pointerdown` or keyboard scroll by the user while playing turns follow off. Programmatic scrolls are marked with a flag so the scroll listener ignores them.
- Auto-scroll: during any gesture (clip drag, resize, fade drag, box select), a `requestAnimationFrame` loop scrolls when the pointer is within 40 px of an edge of the timeline viewport. Speed grows with depth, up to 20 px per frame. The gesture's move handler re-runs with the last pointer position after each scroll step, so the dragged content stays under the pointer.

## R12 — Clip layout, chip and tooltip

**Decision**:
- `TimelineItem.vue` is restructured into layout classes by on-screen width: `--wide` (≥ 120 px), `--medium` (40–120 px) and `--narrow` (< 40 px).
- Look/Effect/Graph clips render a `ClipTargetChip`: a coloured dot plus a label; inherit is shown muted with a "track" suffix (FR-034).
- Clicking the chip opens a PrimeVue `Popover` with a filterable list (Inherit, None, groups, fixtures), built on a new shared `TargetPicker` list. `TargetSelect` gains an `allowInherit` prop for the inspector and track header, reusing its option building.
- Previews: the type-specific preview component stays for audio, pattern, automation and graph. The look and effect summaries move to a body line (wide layout only). The effect shape becomes a full-width SVG `<polyline>` with `cycles = length / (rateBeats·TICKS_PER_BEAT)`, sampled at about one point per 3 px and capped at 600 points.
- Tooltip: `v-tooltip` with a multi-line string, computed only on hover via a `hovered` ref to avoid formatting 500 strings per frame. Lengths are shown as beats and as seconds at the current BPM.
- Fade handles get `v-show="hovered || selected"`.
- Clips narrower than 4 px get `min-width: 4px` visually (their hit area grows slightly) so they stay selectable.

## R13 — Clip inspector strip

**Decision**: `ClipInspector.vue`, docked at the **bottom** of the timeline panel, rendered only while the selection is non-empty (FR-027). A bottom strip pushes only the scrollbar area, not the tracks under the mouse.

Fields:
- count
- source (name, plus an "open" button that sets `library.selectedItemId`)
- target (`TargetSelect` with `allowInherit`, "Mixed" placeholder)
- start
- length
- fade in, fade out
- Make unique, Delete

Fields are hidden when they don't apply (target for non-targetable clips, length for audio, fades unless every selected clip supports fades). Every change goes through `edit()`.

Formats:
- Start: `bar.beat.tick` (1-based bar and beat, 24 ticks per beat), the common DAW notation. Typing `5.3` means bar 5, beat 3, tick 0.
- Length and fades: decimal beats (`4`, `0.5`). Easier to type than bar.beat for durations.

This refines FR-026 ("bars.beats with fractions according to the snap unit") to a standard notation. Length and fade edits clamp per clip (`clampFades`) and respect overlap prevention (the length is clamped to the next clip).

## R14 — Position readout

**Decision**: `PositionReadout.vue` in the toolbar.

- `bar.beat`: `1 + floor(t / (4·24))` . `1 + floor(t / 24) mod 4`. 4/4 time is assumed, matching `MarkerLabel`.
- `m:ss`: `t / 24 / bpm · 60` seconds.

It updates reactively from `globalState.position`. SC check: 120 BPM, bar 5 beat 3 → t = (4·4 + 2)·24 = 432 ticks → 18 beats → 9 s → "0:09".

## R15 — Track drag clamp bug

**Finding**: `onTrackMouseMove` clamps with `diffTracks = timeline.tracks.length - trackIndex`, which is one too far. `tracks[length]` is `undefined` and `newTrack.id` throws. It also clamps per clip in sequence, so a later clip can undo an earlier clip's clamp.

**Decision**: compute `minDiff = −min(trackIndex)` and `maxDiff = (tracks.length − 1) − max(trackIndex)` over the selection and clamp `diffTracks` into `[minDiff, maxDiff]` (FR-006). Part of the rewritten drag code (R9).

## R16 — Dependencies and both targets

No new dependency: PrimeVue (`Popover`, `Select`, `InputText`, `ContextMenu`, `Tooltip`), `@vueuse/core` and Pinia cover everything. Nothing uses Electron APIs or `src/native`, so the feature behaves the same in the browser build (constitution I). The only platform difference is the Alt/menu-bar quirk (R7), which is handled by `preventDefault`.
