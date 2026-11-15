---

description: "Task list for feature 005: Timeline UX Redesign"
---

# Tasks: Timeline UX Redesign

**Input**: Design documents from `specs/005-timeline-ux-redesign/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/timeline-ui.md](./contracts/timeline-ui.md), [contracts/project-state-delta.ts](./contracts/project-state-delta.ts), [quickstart.md](./quickstart.md)

**Tests**: no automated tests (constitution III; not requested in the spec). Each phase ends with manual checks from [quickstart.md](./quickstart.md). Quality gates for every phase: `pnpm lint` and `pnpm build` pass.

**Organization**: tasks are grouped by user story (US1–US7 from spec.md), so each story can be implemented and checked on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: the user story the task belongs to (US1–US7)
- "R#" refers to the decisions in research.md, "FR-###" to the spec requirements

## Path Conventions

Single Vite project: all paths are relative to the repository root (`src/…`). Work is committed directly to `main` (project convention).

---

## Phase 1: Setup

**Purpose**: confirm a green baseline before changing the timeline.

- [X] T001 Run `pnpm lint` and `pnpm build` on the current `main`, note any existing failures (so later failures can be attributed), and confirm `.specify/feature.json` points to `specs/005-timeline-ux-redesign`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: store-level selection, the undo machinery, placement math, time formatting, and gesture/shortcut plumbing that every story builds on.

**⚠️ CRITICAL**: no user story work can begin until this phase is complete.

- [X] T002 [P] Create `src/timeline/model/history.ts` (store-free, R1): export `type TimelineSnapshot = { tracks: ITrackState[]; items: IItemState[] }` and class `TimelineHistory` with `undoStack`/`redoStack` of `{ label: string; snapshot: TimelineSnapshot }`, a limit of 100 entries (drop the oldest), `pending: TimelineSnapshot | null`, plus `push(label, snapshot)` (clears redo), `popUndo(current)`/`popRedo(current)` (moves `current` to the opposite stack and returns the target entry or `null`), `canUndo`, `canRedo`, `topUndoLabel`, `topRedoLabel`, `clear()`. Compare snapshots with `JSON.stringify` in a helper `snapshotsEqual(a, b)`
- [X] T003 [P] Create `src/timeline/timeFormat.ts` (pure, R13/R14), using `TICKS_PER_BEAT` from `@/constants` and 4/4 time:
  - `formatBarBeatTick(ticks)` → `"5.3.12"`, 1-based bar and beat, 24 ticks per beat
  - `parseBarBeatTick(text)` accepts `"5"`, `"5.3"`, `"5.3.12"`; returns `null` on invalid input or negative results
  - `formatBarBeat(ticks)` → `"5.3"`
  - `ticksToBeats` / `beatsToTicks`
  - `formatBeats(ticks)` (decimal, at most 3 digits)
  - `parseBeats(text)` (≥ 0 or `null`)
  - `ticksToSeconds(ticks, bpm)`
  - `formatMinSec(seconds)` → `"0:09"`
  - Check: 432 ticks at 120 BPM → `"5.3"` and `"0:09"`
- [X] T004 [P] Create `src/timeline/model/placement.ts` (pure, R6). Ticks are plain numbers, and there are no store imports.
  - `interface Span { id: string; start: number; end: number; trackIndex: number }`
  - `allowedDelta(moving: Span[], statics: Span[], candidate: number): number | null`: each static on a moving span's destination track forbids the open interval `(static.start − m.end, static.end − m.start)`. Deltas making any `m.start + d < 0` are forbidden. Return the allowed delta closest to `candidate`, ties broken towards 0, or `null` if none is reachable. Touching (`end == start`) is allowed.
  - `clampResize(span, newStart | newEnd, statics)`: clamps the edge to the nearest neighbour on the same track and keeps `end > start`.
  - Static spans that overlap each other are ignored; only moving-vs-static pairs count.
- [X] T005 Move selection into the timeline store in `src/timeline/model/editor.ts` (R2):
  - add reactive `selectedIds = ref(new Set<string>())` and `anchorId = ref<string | null>(null)`
  - add `select(ids: string[], mode: "replace" | "add" | "toggle")`, `selectRange(toId)` (same track as the anchor, every clip whose start lies between anchor and target; another track behaves like replace), `selectAll()`, `clearSelection()`, `isSelected(id)` and computed `selectedItems`
  - drop ids in `removeItem`
  - add `hoveredTrackId = ref<string | null>(null)`
  - expose everything in the store's return object
- [X] T006 Remove `public selected` from `src/timeline/model/item.ts` and update all readers to the store: `unselectAllItems`/`onDragStart`/`keydown` in `src/timeline/components/Timeline.vue`, the `--selected` class and handle `v-show` in `src/timeline/components/TimelineItem.vue` (`timeline.isSelected(item.id)`), and `items.find((i) => i.selected)` in `src/programming/editorContext.ts` (use `timeline.selectedItems`). Depends on T005
- [X] T007 Add history wiring to `src/timeline/model/editor.ts` (R1, data-model "Undo history"). Depends on T002 and T005.
  - Fields and functions:
    - private `history = markRaw(new TimelineHistory())` and `historyVersion` ref
    - computed `canUndo`, `canRedo`, `undoLabel`, `redoLabel`
    - `snapshot()` (tracks + items via `save()`, no `unitWidth`/`headerWidth`)
    - `edit(label, fn)`: snapshot, run, push if changed
    - `beginGesture()` / `endGesture(label)` / `cancelGesture()` (cancel restores `pending` via reconcile without pushing)
  - `undo()` and `redo()` reconcile the store to the popped snapshot by id:
    - restore track fields and order
    - existing items: `move(start, end, true)`, then set `trackId`, `target`, `fadeIn`, `fadeOut`, `resizable`, and `libraryItem` (via `library.getItemById`)
    - create missing items with `Item.load` + `reactive`, and remove extra ones via `removeItem`
    - skip items whose library item is gone
    - recompute audio item `end` from the current BPM (same formula as the BPM watcher)
    - prune `selectedIds`
  - Call `history.clear()` in `load()` and `reset()`.
- [X] T008 [P] Create `src/timeline/composables/useGesture.ts`: `startGesture({ onMove(ev: MouseEvent), onEnd(ev: MouseEvent), onCancel?() })` registers window `mousemove`/`mouseup` listeners (and `keydown` Esc → `onCancel`), removes them on end or cancel, and exposes the last pointer event. While a gesture runs, `keydown`/`keyup` of `Alt` call `preventDefault()` (Electron menu-bar focus, R7). Leave an `autoScroll` option stub (`{ container: HTMLElement }`) that US6 fills in
- [X] T009 [P] Create `src/timeline/composables/useTimelineShortcuts.ts` (R8). Depends on T005.
  - `useTimelineShortcuts(handlers: Partial<Record<ShortcutId, (ev: KeyboardEvent) => void>>)` returns a `keydown` handler.
  - Shortcut ids follow [contracts/timeline-ui.md](./contracts/timeline-ui.md): `undo`, `redo`, `delete`, `selectAll`, `escape`, `copy`, `cut`, `paste`, `duplicate`, `nudgeLeft`, `nudgeRight`, `nudgeLeftBar`, `nudgeRightBar`, `trackUp`, `trackDown`, `playPause`.
  - Return early without `preventDefault` when `ev.target` is an `input`, `textarea`, `select`, `[contenteditable]` or inside `.p-popover`/`.p-select-overlay`/`.p-dialog`.
  - Treat `ev.ctrlKey || ev.metaKey` as Ctrl. Call `preventDefault()` only when a handler ran.
- [X] T010 Rewire `src/timeline/components/Timeline.vue` onto the foundation without changing visible behaviour. Depends on T006, T008 and T009.
  - remove `ctrlPressed`, the blanket `ev.preventDefault()` in `keydown`/`keyup`, and the `keyup` handler
  - bind `@keydown` to `useTimelineShortcuts` with `delete` (Delete) and `playPause` (Space)
  - focus the root element on mousedown
  - run clip drags through `startGesture` (window listeners) instead of track `mousemove`, deriving the hovered track from `ev.clientY` relative to the track rows (40 px header row, `--rowHeight` 100 px) rather than `mouseenter`
  - store the hovered track id in `timeline.hoveredTrackId`

**Checkpoint**: the timeline works as before (drop, drag, resize, fade, delete, play), with selection in the store and gestures on window listeners. `pnpm lint` and `pnpm build` pass.

---

## Phase 3: User Story 1 - Undo mistakes and edit safely (Priority: P1) 🎯 MVP

**Goal**: every timeline edit can be undone and redone. Dragging below the last track no longer crashes.

**Independent Test**: quickstart Q1–Q4. Move, resize, delete and add clips, change a target and fades, edit tracks, then undo and redo each step.

- [X] T011 [US1] Fix the track clamp and grid snap in the clip drag in `src/timeline/components/Timeline.vue` (R15, R7, FR-006):
  - compute `minDiff = −min(trackIndex)` and `maxDiff = (tracks.length − 1) − max(trackIndex)` over the drag start states and clamp `diffTracks` once
  - snap only the dragged clip (`newStart = snap(dragStart.start + diffUnits)`), then apply `delta = newStart − dragStart.start` to every selected clip
- [X] T012 [US1] Wrap the gestures in `src/timeline/components/Timeline.vue` with history: `timeline.beginGesture()` at clip drag/resize start, `timeline.endGesture("Move" | "Resize")` on end, `cancelGesture()` on Esc. Wrap `drop()` in `timeline.edit("Add clip", …)` and Delete in `timeline.edit("Delete", …)`
- [X] T013 [P] [US1] Wrap the fade drag in `src/timeline/components/TimelineItem.vue`: `beginGesture()` in `startFadeDrag`, `endGesture("Fade")` in `onUp`. Wrap `setTarget` in `timeline.edit("Target", …)`
- [X] T014 [P] [US1] Wrap the track operations in `src/timeline/components/Track.vue` (`moveUp`/`moveDown` → `edit("Move track")`, `remove` → `edit("Remove track")`) and `save()` in `src/timeline/components/TrackSettings.vue` (`edit("Track settings")`)
- [X] T015 [US1] Add the undo/redo shortcuts (`undo`: Ctrl+Z; `redo`: Ctrl+Y and Ctrl+Shift+Z) in the `useTimelineShortcuts` handlers in `src/timeline/components/Timeline.vue`
- [X] T016 [US1] Add Undo and Redo buttons (`mdi-undo`/`mdi-redo`, disabled by `canUndo`/`canRedo`, tooltip "Undo <label>"/"Redo <label>") to the toolbar in `src/timeline/Timeline.vue`, and wrap "Add Track" in `timeline.edit("Add track", …)`

**Checkpoint**: Q1–Q4 pass in both targets. One drag = one undo step. Undo restores audio clips with the current BPM length.

---

## Phase 4: User Story 2 - Select many clips quickly (Priority: P1)

**Goal**: click modes, Shift ranges, box select, Ctrl+A, Esc, double-click to open, Backspace delete.

**Independent Test**: quickstart Q5–Q6.

- [X] T017 [US2] Implement the click modes in `src/timeline/components/Timeline.vue` `onDragStart` (FR-007), reading modifiers from the mouse event:
  - Ctrl → `select([id], "toggle")`, no drag when this toggled the clip off
  - Shift → `selectRange(id)`
  - no modifier on an unselected clip → `select([id], "replace")`
  - no modifier on an already selected clip → keep the selection for a group drag, and replace it with this clip on mouseup if the pointer moved < 3 px
  - set `anchorId` on plain and Ctrl clicks
  - `TimelineItem.vue` must pass the original `MouseEvent` with the `dragStart` emit (change the emit payload to `(area, ev)`)
- [X] T018 [P] [US2] Create `src/timeline/components/SelectionRect.vue`: an absolutely positioned div (props `x`, `y`, `width`, `height` in content pixels), with a primary-colour border and 15 % fill, `pointer-events: none`, `z-index` above the clips
- [X] T019 [US2] Implement box select in `src/timeline/components/Timeline.vue` (R9, FR-008, FR-009). Depends on T017 and T018.
  - Start: mousedown on `.item-container` space whose target is not inside `.timeline-item`. Ruler and track headers never start a box select.
  - Run it through `startGesture` and track the rectangle in `.content` coordinates (account for `scrollLeft`/`scrollTop`).
  - Hit test with math only: x → ticks via `(x − headerWidth) / unitWidth`; y → track index range via the 40 px header row and 100 px rows. A clip is hit when its track is in range and its time range intersects.
  - Update the selection live against the selection at drag start: replace, Shift = add, Ctrl = toggle.
  - Mouseup with < 3 px movement: clear the selection.
  - Esc: restore the start selection and cancel.
  - Render `SelectionRect` inside `.content`.
- [X] T020 [US2] Add `selectAll` (Ctrl+A) and `escape` (Esc → `clearSelection`) to the shortcut handlers, and add Backspace to `delete`, in `src/timeline/components/Timeline.vue`
- [X] T021 [P] [US2] Add `@dblclick` on the clip in `src/timeline/components/TimelineItem.vue` → `useLibrary().selectedItemId = item.libraryItem.id`, so the editor above opens it (FR-010)

**Checkpoint**: Q5–Q6 pass. A group drag after box select moves all selected clips.

---

## Phase 5: User Story 3 - Copy, paste and duplicate clips (Priority: P1)

**Goal**: Ctrl+C/X/V/D, Alt+drag copies, linked copies, Make unique.

**Independent Test**: quickstart Q7–Q9.

- [X] T022 [P] [US3] Create `src/timeline/model/clipboard.ts` (pure, R10, data-model "Clipboard"):
  - `interface ClipboardEntry { state: IItemState; dt: number; dTrack: number }`
  - `buildEntries(items: { state: IItemState; trackIndex: number }[]): ClipboardEntry[]`: `dt` relative to the earliest start, `dTrack` relative to the topmost track index
  - `layoutEntries(entries, baseTick, baseTrackIndex)`: returns the target `{ start, end, trackIndex, state }` per entry
- [X] T023 [P] [US3] Change `duplicateItem` in `src/library/libraryModel.ts` to name the copy `` `${item.name} (copy)` `` and return it (`Promise<LibraryItem>`). Callers in `src/library/LibraryItem.vue` still work (they ignore the result)
- [X] T024 [US3] Add clipboard operations to `src/timeline/model/editor.ts` (FR-012–FR-014, FR-016). Depends on T004, T007 and T022.
  - `clipboard` ref, cleared in `load()`/`reset()`
  - `copySelection()`
  - `cutSelection()` (`edit("Cut")`)
  - `paste()` (`edit("Paste")`):
    - base tick = `globalState.position`
    - base track = `hoveredTrackId`, otherwise the topmost track of the copied set if it still exists, otherwise 0
    - create tracks with `addDefaultTrack()` when `baseTrack + dTrack` exceeds the track count
    - skip entries whose `libraryItemId` no longer resolves
    - new ids via `Item.load({ ...state, id: uuid })`
    - shift the whole set by `allowedDelta(moving, statics, 0)`; abort with no change if `null`
    - select the pasted clips
  - `duplicateSelection()` (`edit("Duplicate")`): base tick = max end of the selection, same tracks.
  - Copies keep `target` (explicit, `"inherit"` or `null`) and fades.
- [X] T025 [US3] Add `copy`/`cut`/`paste`/`duplicate` shortcut handlers in `src/timeline/components/Timeline.vue` calling the store functions
- [X] T026 [US3] Implement Alt+drag copies in `src/timeline/components/Timeline.vue` (FR-015): when a centre drag starts with `ev.altKey`, inside the open gesture, clone the selected clips in place (new ids, same state), select the clones and drag them. The originals stay. One undo step ("Copy clips")
- [X] T027 [US3] Add `makeUnique(items)` to `src/timeline/model/editor.ts` (FR-017, R10). Depends on T023.
  - run inside `edit("Make unique")`
  - group the clips by library item, `await library.duplicateItem` once per group, and point every clip of the group to the copy
  - skip audio and script clips (`createItemByType` has no `SCRIPT` case)
  - the duplicated library item stays after undo (outside the timeline history)
  - `edit` must support an async `fn`: add `editAsync(label, fn)` that snapshots before and pushes after awaiting
- [X] T028 [US3] Replace the context menu model in `src/timeline/components/TimelineItem.vue` with entries Make unique (disabled for audio/script), Copy, Duplicate and Delete, acting on the selection (right-click on an unselected clip selects it first). Show the menu for every clip type, not only targetable ones. The Target submenu follows in US4

**Checkpoint**: Q7–Q9 pass. Pasted clips edit together with the original until Make unique.

---

## Phase 6: User Story 4 - Assign targets fast and for many clips at once (Priority: P1)

**Goal**: live inherit, target chip with a one-click picker, track header chip, clip inspector strip with multi-edit.

**Independent Test**: quickstart Q10–Q13.

- [X] T029 [US4] Change the clip target model in `src/timeline/model/item.ts` (R3, [contracts/project-state-delta.ts](./contracts/project-state-delta.ts)):
  - export `type ClipTarget = Target | "inherit" | null`
  - `public target: ClipTarget = "inherit"`
  - `IItemState.target?: ClipTarget`
  - `load`: `isTarget(v)` → explicit copy, `v === "inherit"` → `"inherit"`, anything else → `null`
  - `save`: writes the explicit copy, `"inherit"` or `null`
- [X] T030 [US4] Add `effectiveTarget(item: Item): Target | null` to `src/programming/targets.ts`: `item.target === "inherit" ? useTimeline().getTrackById(item.trackId)?.defaultTarget ?? null : item.target`. Depends on T029
- [X] T031 [US4] Switch every `item.target` reader to `effectiveTarget` (the compiler flags them after T029). Depends on T030.
  - `attributeOutputTarget` and the effect/look branches in `src/programming/processor.ts`
  - `src/programming/uses.ts`: count clips with an explicit group target, plus tracks, as today
  - `src/programming/editorContext.ts`
  - `targetText` in `src/programming/look/LookPreview.vue` and `src/programming/effect/EffectPreview.vue`
  - `src/timeline/baseTimelineProcessor.ts` goes through `attributeOutputTarget`; verify it compiles
- [X] T032 [US4] In `drop()` in `src/timeline/components/Timeline.vue`, replace the copy of `chosenTrack.defaultTarget` with `item.target = "inherit"` (FR-018). Also remove the old feature-004 comment
- [X] T033 [P] [US4] Add `allowInherit?: boolean` to `src/programming/components/TargetSelect.vue`:
  - adds "Inherit (track target)" (value `"inherit"`) to the General group
  - extend `TargetSelectValue` to `Target | null | "clip" | "inherit"`
  - add a `mixed?: boolean` prop that shows the placeholder "Mixed" with no selected value
  - export the option-building function (`buildTargetOptions({ allowClip, allowNone, allowInherit, fixturesOnly })`) for reuse
- [X] T034 [US4] Create `src/programming/components/TargetPicker.vue`, a filterable list (PrimeVue `Listbox` with `filter`, grouped options from `buildTargetOptions`). Props: `modelValue`, `allowInherit`. Emits `update:modelValue` and `close` on pick. Depends on T033
- [X] T035 [US4] Create `src/timeline/components/ClipTargetChip.vue` (R12):
  - props `target: ClipTarget`, `effective: Target | null`, `allowInherit` (default true)
  - renders a dot plus a label (`targetLabel(effective)`); "· track" and muted styling when `target === "inherit"`; "No target" with warning styling when `effective` is null
  - click (`@mousedown.stop`) opens a PrimeVue `Popover` containing `TargetPicker`
  - emits `update:target`
  - Depends on T034
- [X] T036 [US4] Integrate targets into `src/timeline/components/TimelineItem.vue` (FR-021, FR-023):
  - render `ClipTargetChip` for targetable types (`TARGET_TYPES`) under the header; picking runs `timeline.edit("Target", …)` on this clip
  - remove the `Dialog`/`targetDialog`/"Target…" entry
  - add a "Target" submenu to the context menu with Inherit, None, groups and fixtures, applying to all selected targetable clips in one `edit`
- [X] T037 [US4] Add a track target chip to the header in `src/timeline/components/Track.vue` (FR-022): `ClipTargetChip` with `allowInherit=false`, `target = effective = track.defaultTarget`; changes run `timeline.edit("Track target", …)`. Keep the `TrackSettings` field working
- [X] T038 [US4] Create `src/timeline/components/ClipInspector.vue` (R13, FR-024–FR-027, [contracts/timeline-ui.md](./contracts/timeline-ui.md) inspector table). Depends on T003, T004, T027 and T033.
  - Count and Source: "N clips"; library item name or "N items" if they differ; open button sets `library.selectedItemId`.
  - Target: `TargetSelect allowInherit`, `mixed` when values differ; shown only if ≥ 1 targetable clip; applies to targetable clips only.
  - Start (`parseBarBeatTick`): sets every selected clip's start, keeping its length.
  - Length (`parseBeats`): hidden if any audio clip is selected; clamped per clip with `clampResize`.
  - Fade in/out (`parseBeats`): shown only if every clip is Look/Effect; clamped with `clampFades`.
  - Make unique and Delete buttons.
  - Inputs commit on Enter/blur. Each commit is one `timeline.edit(...)`. Invalid input reverts the field.
- [X] T039 [US4] Mount `ClipInspector` at the bottom of the timeline panel in `src/timeline/Timeline.vue`, `v-if="timeline.selectedIds.size > 0"`, below `#wrapper`, so the track area keeps its size while nothing is selected

**Checkpoint**: Q10–Q13 pass. An old project plays back identically. 10 clips can be retargeted in 3 actions (SC-001).

---

## Phase 7: User Story 5 - Read clip information at a glance (Priority: P2)

**Goal**: target colours, hatching for missing targets, width-based layouts, tooltips, hover-only fade handles, full-width effect shape.

**Independent Test**: quickstart Q16 (clip layouts and colours).

- [X] T040 [P] [US5] Create `src/programming/targetColors.ts` (pure, R4): `targetColor(target: Target | null): string | null` → FNV-1a hash of `` `${kind}:${id}` `` → `hsl(<hash mod 360> 65% 55%)`. Returns `null` for `null`. Use it for the chip dot in `src/timeline/components/ClipTargetChip.vue`
- [X] T041 [US5] Restyle `src/timeline/components/TimelineItem.vue` (R12, FR-028–FR-030, FR-034):
  - computed `layout` from `widthPx`: `wide` ≥ 120, `medium` ≥ 40, otherwise `narrow`
  - left 4 px colour bar and 12 % body tint from `targetColor(effectiveTarget(item))`
  - targetable clips with no effective target: diagonal hatching (`repeating-linear-gradient`) and the warning icon at all widths, with "No target" added to the warning list
  - wide: name, chip, summary line and preview
  - medium: name and chip
  - narrow: colour bar and the first letter of the name, chip hidden
  - `min-width: 4px`
- [X] T042 [US5] Add the lazy tooltip in `src/timeline/components/TimelineItem.vue` (FR-031):
  - a `hovered` ref set on `mouseenter`/`mouseleave`
  - `v-tooltip` text built only while hovered: name, type, target (+ "inherited from track"), start `formatBarBeatTick`, length in beats (`formatBeats`) and seconds (`ticksToSeconds` with `globalState.bpm`), and fades (Look/Effect)
  - fade handles get `v-show="hovered || selected"` (FR-032); the fade overlay stays visible
- [X] T043 [P] [US5] Make `src/programming/effect/EffectPreview.vue` draw the shape across the whole clip (FR-033):
  - with `item` and `unitWidth`, render a full-width SVG `polyline`
  - `cycles = (item.end − item.start) / (rateBeats · TICKS_PER_BEAT)`, sampled at about one point per 3 px, capped at 600 points
  - the label becomes a summary line without the target text
  - keep the compact icon variant for library usage (`compact`/no `item`)
- [X] T044 [P] [US5] Reduce `src/programming/look/LookPreview.vue` to the swatch and summary line (remove the `→ target` text, because the chip shows it); keep the compact variant

**Checkpoint**: Q16 passes. A clip's target is readable at any width ≥ 4 px (SC-003).

---

## Phase 8: User Story 6 - Navigate the timeline (Priority: P2)

**Goal**: wheel scrolling, Ctrl+wheel zoom, zoom to fit, follow playhead, auto-scroll during gestures, position readout.

**Independent Test**: quickstart Q17–Q19.

- [X] T045 [US6] Rewrite `wheel` in `src/timeline/components/Timeline.vue` (R11, FR-035):
  - only with `ev.ctrlKey || ev.metaKey`: `preventDefault()` and zoom anchored at `ev.clientX` (replacing `ev.screenX`), clamped to `0.05 ≤ unitWidth ≤ 50`
  - otherwise return without `preventDefault`, so native vertical scrolling and Shift+wheel horizontal scrolling work
- [X] T046 [US6] Add `followPlayhead = ref(false)` and `zoomToFit(viewWidth)` to `src/timeline/model/editor.ts`. `zoomToFit` sets `unitWidth = (viewWidth − headerWidth − 20) / max(lastItemEnd, 4 · 4 · TICKS_PER_BEAT)`, clamped. The component resets `scrollLeft = 0`
- [X] T047 [US6] Implement follow mode in `src/timeline/components/Timeline.vue` (FR-037):
  - watch `globalState.position` while `isPlaying && followPlayhead`
  - when the playhead x passes 90 % of the visible time range, set `scrollLeft` so it sits at 10 %, marking the scroll as programmatic
  - a `scroll` event not marked as programmatic, a `wheel`, or a `pointerdown` on the scrollbar while playing sets `followPlayhead = false`
- [X] T048 [US6] Implement auto-scroll in `src/timeline/composables/useGesture.ts` (FR-038, R11):
  - with the `autoScroll.container` option, a `requestAnimationFrame` loop scrolls when the pointer is within 40 px of a container edge, at a speed proportional to depth (max 20 px/frame)
  - after each scroll step, call `onMove` again with the last pointer event
  - enable it for clip drag, resize and box select in `src/timeline/components/Timeline.vue`, and for the fade drag in `src/timeline/components/TimelineItem.vue` (move it onto `startGesture`)
- [X] T049 [P] [US6] Create `src/timeline/components/PositionReadout.vue` (FR-039, R14): shows `formatBarBeat(globalState.position)` and `formatMinSec(ticksToSeconds(position, bpm))` in monospace
- [X] T050 [US6] Extend the toolbar in `src/timeline/Timeline.vue`: "Zoom to fit" button (`mdi-arrow-expand-horizontal`, calls `zoomToFit` with the wrapper width and resets the scroll via an exposed method or event of `TimelineBase`), "Follow" `ToggleButton` (`mdi-page-next-outline`) bound to `followPlayhead`, and `PositionReadout`. Depends on T046 and T049

**Checkpoint**: Q17–Q19 pass. A 20-track, 5-minute show is navigable with the wheel only (SC-006).

---

## Phase 9: User Story 7 - Precise editing: nudge, snapping, no overlaps (Priority: P3)

**Goal**: arrow nudges, magnetic snapping with Alt to disable, overlap prevention on every edit path.

**Independent Test**: quickstart Q14–Q15.

- [X] T051 [US7] Add the snapping functions to `src/timeline/model/placement.ts` (R7, FR-042):
  - `snapCandidates(statics: Span[], playhead: number): number[]` (all edges plus the playhead)
  - `magneticDelta(moving: Span[], candidates: number[], rawDelta: number, thresholdTicks: number): number | null`: the smallest distance from any moving edge (after `rawDelta`) to a candidate within the threshold
  - `magneticEdge(edge, candidates, thresholdTicks)` for resize
- [X] T052 [US7] Apply snapping and overlap prevention in the drag/resize code in `src/timeline/components/Timeline.vue` (FR-042–FR-044):
  - delta order: Alt held → raw ticks (no grid, no magnetic snapping); otherwise the magnetic delta (threshold `8 / unitWidth`) if found, else the grid delta from T011
  - then `allowedDelta(moving, statics, delta)`; keep the last valid position if `null`
  - resize: magnetic/grid on the dragged edge (unless Alt), then `clampResize` per clip
  - statics = clips not in the selection
- [X] T053 [US7] Add Alt as a "no snap" modifier to the fade drag in `src/timeline/components/TimelineItem.vue` (`e.shiftKey || e.altKey` → `Math.round(raw)`)
- [X] T054 [US7] Add `nudge(deltaTicks)` and `moveSelectionTracks(dir: -1 | 1)` to `src/timeline/model/editor.ts` (FR-040), each one `edit("Nudge")` / `edit("Move to track")`:
  - `nudge` goes through `allowedDelta`
  - `moveSelectionTracks` rejects (no change) when any clip would leave the track range or `allowedDelta(…, 0)` is not 0
- [X] T055 [US7] Add the arrow shortcuts in `src/timeline/components/Timeline.vue`:
  - ←/→ → `nudge(∓ max(1, globalState.snapUnits))`
  - Shift+←/→ → `nudge(∓ 4 · TICKS_PER_BEAT)`
  - ↑/↓ → `moveSelectionTracks(∓1)`
- [X] T056 [US7] Change the overlap test in `drop()` in `src/timeline/components/Timeline.vue` from `<=` to `<`, so touching clips count as free (FR-045)

**Checkpoint**: Q14–Q15 pass. No edit path can create overlapping clips on one track; old overlaps are left untouched.

---

## Phase 10: Polish & Cross-Cutting Concerns

- [X] T057 Remove dead code left by the redesign: the unused `Dialog` import and `targetDialog` in `src/timeline/components/TimelineItem.vue`, the `ctrlPressed`/`dragStartTrack` leftovers in `src/timeline/components/Timeline.vue`, and the `.--disable-child-pointer-events` mismatch (class `disable-child-pointer-events` vs selector `.--disable-child-pointer-events`) in the same file
- [X] T058 Performance pass for SC-007 with 500 clips:
  - compute per-track item lists once in `src/timeline/model/editor.ts` (a `Map<trackId, Item[]>` computed) and use it in `src/timeline/components/Track.vue` instead of filtering all items per track
  - confirm the tooltip and polyline work only happens on hover or width change
- [X] T059 Run `pnpm lint` and `pnpm build`; fix all errors and warnings introduced by this feature
- [ ] T060 Carry out [quickstart.md](./quickstart.md) Q1–Q22 and the spec's 9-step Manual Verification in the browser build (`pnpm dev`) and the desktop build (`pnpm electron:dev`). Record the results and any deviations in `specs/005-timeline-ux-redesign/quickstart.md`
- [X] T061 Set **Status** in `specs/005-timeline-ux-redesign/spec.md` to "Implemented". Commit to `main` with a message that states the project file change (constitution IV): "projects saved with this version store `"inherit"` clip targets and do not load correctly in older builds"

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: after Setup. Blocks all user stories.
- **US1 (Phase 3)**: after Foundational. Recommended first, because it makes every later change safe to try out.
- **US2–US7 (Phases 4–9)**: after Foundational. Most can follow in any order, with the cross-story touch points listed below.
- **Polish (Phase 10)**: after the desired stories.

### User Story Dependencies

| Story | Depends on | Notes |
|---|---|---|
| US1 Undo | Foundational | none |
| US2 Selection | Foundational | Group drag benefits from US1's clamp fix (T011) |
| US3 Clipboard | Foundational (T004, T007) | Uses the store selection; box select (US2) makes it practical but is not required |
| US4 Targets | Foundational (T003, T004) | T038 inspector offers Make unique from US3 (T027); without US3, omit that button |
| US5 Visuals | US4 (T030 `effectiveTarget`, T035 chip) | Colour and hatching need the effective target |
| US6 Navigation | Foundational (T008) | none |
| US7 Precise editing | Foundational (T004), US1 (T011 grid delta) | none |

### Within Each Story

Store/model tasks come before component tasks. Tasks touching the same file (`src/timeline/components/Timeline.vue`, `src/timeline/components/TimelineItem.vue`, `src/timeline/model/editor.ts`) run sequentially, in ID order.

### Parallel Opportunities

- Phase 2: T002, T003, T004, T008 and T009 are separate new files.
- US1: T013 (TimelineItem) and T014 (Track/TrackSettings) alongside T011/T012 (Timeline.vue).
- US2: T018 (SelectionRect) and T021 (TimelineItem) alongside T017.
- US3: T022 (clipboard.ts) and T023 (libraryModel) together.
- US4: T033 (TargetSelect) while T029–T032 (model and readers) are in progress.
- US5: T040, T043 and T044 are separate files.
- US6: T049 (PositionReadout) alongside T045–T048.

---

## Parallel Example: Foundational Phase

```text
Task: "T002 Create src/timeline/model/history.ts (TimelineHistory, snapshots, limit 100)"
Task: "T003 Create src/timeline/timeFormat.ts (bar.beat.tick, beats, m:ss)"
Task: "T004 Create src/timeline/model/placement.ts (allowedDelta, clampResize)"
Task: "T008 Create src/timeline/composables/useGesture.ts (window listeners, Alt preventDefault)"
Task: "T009 Create src/timeline/composables/useTimelineShortcuts.ts (input guard, Ctrl/Meta)"
```

## Parallel Example: User Story 4

```text
Task: "T033 Add allowInherit/mixed props and buildTargetOptions to src/programming/components/TargetSelect.vue"
Task: "T029 Change Item.target to ClipTarget with load rules in src/timeline/model/item.ts"
# then sequentially: T030 → T031 → T032, and T034 → T035 → T036/T037 → T038 → T039
```

---

## Implementation Strategy

### MVP first (US1)

1. Phase 1 Setup and Phase 2 Foundational.
2. Phase 3 (US1): undo/redo plus the drag clamp fix.
3. **Stop and validate**: Q1–Q4 in both targets, `pnpm lint` and `pnpm build`. This can already be committed: the timeline is safer, with no visible regressions.

### Incremental delivery

1. US2 (selection), then US3 (clipboard): the two features the user asked for. Commit after each.
2. US4 (targets): the biggest workflow gain. This is the point where the project file changes (`"inherit"`); mention it in that commit.
3. US5 (visuals), then US6 (navigation), then US7 (precise editing).
4. Polish: performance, full quickstart in both targets, status update.

Each story ends at its checkpoint with a green `pnpm lint` and `pnpm build`, so `main` stays deployable after every commit.

---

## Notes

- [P] = different files, no dependency on an unfinished task.
- Every new edit path must go through `timeline.edit()` / `beginGesture()`, otherwise it silently escapes undo (SC-004).
- Do not touch `Track.data` or the processor's merge logic. The only playback change is `effectiveTarget` (T031).
- Keep `item.move(…, true)` (force) only for undo reconciliation; normal moves keep the `beforeMoved` guard that blocks moving audio during playback.
