# Implementation Plan: Timeline UX Redesign

**Branch**: `005-timeline-ux-redesign` (feature directory; work is committed directly to `main` per project convention) | **Date**: 2026-11-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/005-timeline-ux-redesign/spec.md`

## Summary

Make the timeline efficient for multi-clip editing and readable at a glance:

- **Foundations**:
  - a store-level selection (R2) and a snapshot-based timeline undo/redo that restores by reconciling objects in place (R1)
  - one shortcut handler that ignores text inputs (R8)
  - window-level gesture handling with the track-clamp bug fixed (R9, R15)
  - native wheel scrolling with Ctrl+wheel zoom (R11)
- **Selection and clipboard**: geometric box select (R9), Shift ranges, Ctrl+A/Esc, double-click to open; an in-store clipboard with paste at the playhead, Ctrl+D and Alt+drag; linked copies plus "Make unique" (R10).
- **Targets**: `item.target` gains an `"inherit"` value resolved live through `effectiveTarget()` (R3); a target chip with a popover picker on clips and in track headers; a clip inspector strip with multi-edit at the bottom of the timeline panel (R13).
- **Visuals**: hashed target colours, hatching for clips without a target (R4), three layouts by clip width, lazy tooltips, fade handles on hover, full-width effect shape (R12).
- **Precise editing**: arrow nudges; overlap prevention through one pure placement function (R6); grid snapping relative to the dragged clip plus magnetic edges, with Alt to disable (R7); follow playhead, auto-scroll and position readout (R11, R14).

No new dependency, no Rust/WASM/bridge change. Saved state: `IItemState.target` may be `"inherit"`; old projects load and play back unchanged.

## Technical Context

**Language/Version**: TypeScript 5.8, Vue 3.5 (Composition API, `<script setup>`)

**Primary Dependencies**: Pinia 3 (timeline, library and global stores), PrimeVue 4 (`Popover`, `Select`, `InputText`, `ContextMenu`, `Tooltip`, `ToggleButton`), `@vueuse/core` (`useElementBounding`). All are already installed (R16).

**Storage**: project file (`SavedState`). Change to `IItemState`: `target` may be `"inherit"`. See [contracts/project-state-delta.ts](./contracts/project-state-delta.ts). Selection, clipboard, undo history and follow mode are not saved.

**Testing**: no automated tests required (constitution III). `placement.ts` (R6), `targetColor` (R4) and the bar.beat.tick format/parse (R13/R14) are pure and good candidates for optional unit tests later; no test runner is added. Manual verification: [quickstart.md](./quickstart.md) (Q1–Q22) and the spec's 9-step procedure, in both targets. Quality gates: `pnpm lint`, `pnpm build`.

**Target Platform**: Electron 36 desktop app and the browser build (GitHub Pages).

**Project Type**: desktop/web single-page application (one Vite project).

**Performance Goals**: SC-007: 500 clips with no visible lag while dragging, box-selecting, scrolling and zooming. This means:
- O(selection × clips on destination tracks) placement per mouse move
- geometric hit tests for box select (no DOM queries)
- tooltip text computed on hover only
- effect polylines capped at 600 points
- per-track item lists computed once per change, not per clip

**Constraints**:
- Both targets (constitution I). Alt/menu-bar quirk in Electron handled by `preventDefault` (R7).
- Audio clips: not resizable. Moving audio during playback stays blocked by the existing `beforeMoved` guard (undo restores use `force`).
- `src/programming` pure modules stay store-free; `effectiveTarget` lives in `targets.ts`, which already reads stores.

**Scale/Scope**:
- New modules (7): `timeline/model/history.ts`, `timeline/model/placement.ts`, `timeline/model/clipboard.ts`, `timeline/composables/useTimelineShortcuts.ts`, `timeline/composables/useGesture.ts` (window listeners + auto-scroll), `programming/targetColors.ts`, `timeline/timeFormat.ts`
- New components (5): `ClipInspector.vue`, `ClipTargetChip.vue`, `TargetPicker.vue`, `SelectionRect.vue`, `PositionReadout.vue`
- Changed files (≈12):
  - timeline: `Timeline.vue` (both), `TimelineItem.vue`, `Track.vue`, `TrackSettings.vue`, `model/editor.ts`, `model/item.ts`, `baseTimelineProcessor.ts`
  - programming: `processor.ts`, `targets.ts`, `uses.ts`, `editorContext.ts`, `TargetSelect.vue`, effect/look previews
  - other: `library/libraryModel.ts` (`duplicateItem` returns the item)

All technical unknowns are resolved in [research.md](./research.md) (R1–R16). No NEEDS CLARIFICATION items remain.

**Refinements of the spec made in research** (no change in intent):
- FR-026: start is shown as `bar.beat.tick`; length and fades as decimal beats (R13).
- FR-044: dragging uses the "nearest allowed position", so a dragged clip sits flush against an obstacle and jumps past it once there is room (R6).
- FR-041 (split at playhead) was removed at the user's request (R5).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| **I. Two targets, one codebase** | Pure TypeScript and Vue UI, no runtime checks, no Electron or `src/native` use. The browser build stays the CI target. The only platform difference (Alt focusing the Electron menu bar) is neutralized in shared code. | ✅ Pass |
| **II. Typed boundaries & quality gates** | The `ClipTarget` union is typed ([contracts/](./contracts/)); the union makes the compiler flag every old `item.target` reader (R3). No Rust or bridge change, so there are no bindings to regenerate. `pnpm lint` and `pnpm build` are done criteria. | ✅ Pass |
| **III. Manual verification** | The spec has a 9-step procedure; quickstart.md expands it to 22 scenarios with expected results, in both targets. | ✅ Pass |
| **IV. Free iteration before 1.0** | Saved-state changes are additive; old projects load and play back identically (Q13). Projects saved with this feature (`"inherit"` targets) do not load correctly in older builds. That must be stated in the commit message. | ✅ Pass |
| **V. Simplicity first** | No new dependency. Undo uses snapshots instead of per-command inverses (R1). One placement function serves every edit path (R6). Target colours are derived instead of stored (R4). No system clipboard, global history or colour UI. Split was dropped to avoid a source-offset field through playback (R5); see Complexity Tracking. | ✅ Pass (see Complexity Tracking) |

**Post-design re-check (after Phase 1)**: still passes.

- **Store boundaries**: selection, clipboard, history and follow mode live in the timeline store. `history.ts` and `placement.ts` are store-free (they get snapshots and item lists passed in).
- **Processor impact**: the only runtime change in playback is `effectiveTarget(item)` instead of `item.target`. With explicit targets (every old project), the output is identical.
- **Overlap rule**: applies only to new edits; existing overlaps in loaded projects are left alone.

## Project Structure

### Documentation (this feature)

```text
specs/005-timeline-ux-redesign/
├── plan.md              # This file
├── research.md          # Phase 0 (R1–R16)
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1 (Q1–Q22)
├── contracts/
│   ├── project-state-delta.ts   # saved-state change (target "inherit")
│   └── timeline-ui.md           # shortcuts, mouse gestures, toolbar, inspector, clip appearance
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
src/
├── timeline/
│   ├── Timeline.vue                       # toolbar: undo/redo, zoom to fit, follow, PositionReadout; ClipInspector at the bottom
│   ├── timeFormat.ts                      # NEW: bar.beat.tick format/parse, beats↔seconds (pure)
│   ├── composables/
│   │   ├── useTimelineShortcuts.ts        # NEW: keyboard contract (R8)
│   │   └── useGesture.ts                  # NEW: window listeners, auto-scroll loop, Alt handling (R9, R11)
│   ├── model/
│   │   ├── editor.ts                      # selection, clipboard, history wiring, edit()/gestures, nudge,
│   │   │                                  #   paste/duplicate, makeUnique, followPlayhead, hoveredTrackId
│   │   ├── history.ts                     # NEW: TimelineHistory + reconcile (R1)
│   │   ├── placement.ts                   # NEW: allowedDelta, clampResize, magnetic snap candidates (R6, R7) (pure)
│   │   ├── clipboard.ts                   # NEW: copy/paste entry building (R10) (pure)
│   │   ├── item.ts                        # target: ClipTarget; selected removed
│   │   └── track.ts                       # unchanged shape
│   └── components/
│       ├── Timeline.vue                   # rewritten interaction: box select, drag/resize via placement, wheel, follow
│       ├── TimelineItem.vue               # layouts, colour bar/tint, hatching, chip, tooltip, hover fade handles, context menu
│       ├── Track.vue                      # header target chip; track ops through edit()
│       ├── TrackSettings.vue              # save through edit()
│       ├── ClipInspector.vue              # NEW (R13)
│       ├── ClipTargetChip.vue             # NEW (R12)
│       ├── SelectionRect.vue              # NEW
│       └── PositionReadout.vue            # NEW (R14)
├── programming/
│   ├── targets.ts                         # effectiveTarget(item)
│   ├── targetColors.ts                    # NEW: targetColor() (pure)
│   ├── processor.ts                       # effectiveTarget
│   ├── uses.ts, editorContext.ts          # effectiveTarget / store selection
│   ├── components/TargetSelect.vue        # allowInherit prop
│   ├── components/TargetPicker.vue        # NEW: filterable list for the chip popover
│   └── effect/EffectPreview.vue, look/LookPreview.vue   # summary-only (body line), full-width effect shape
└── library/libraryModel.ts                # duplicateItem returns the copy, names it "(copy)"
```

**Structure Decision**: single Vite project. Feature code stays in `src/timeline` (interaction, model) and `src/programming` (target resolution and colours), following the existing layout. New pure logic goes into small modules next to the store.

## Implementation Order (for /speckit-tasks)

1. **Foundations (US1)**:
   - `item.selected` → store selection
   - history + `edit()`/gestures and reconcile
   - wrap every existing edit path (drop, delete, drag, resize, fade drag, track ops, track settings, target)
   - shortcuts composable
   - window-level gestures and the clamp fix
2. **Selection (US2)**: click modes, Shift range, box select, Ctrl+A/Esc, double-click.
3. **Clipboard (US3)**: copy/cut/paste/duplicate, Alt+drag (needs `placement.ts`, so build it here), Make unique.
4. **Targets (US4)**: `ClipTarget` + load rules, `effectiveTarget` everywhere, chip + picker, track header chip, inspector strip.
5. **Visuals (US5)**: colours/hatching, layouts, tooltip, hover fade handles, effect shape.
6. **Navigation (US6)**: wheel, zoom to fit, follow, auto-scroll, readout.
7. **Precise editing (US7)**: nudge, magnetic snapping + Alt, overlap prevention on all paths, the drop `<` fix.

## Complexity Tracking

| Addition | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Snapshot history with reconcile | Every timeline edit must be undoable (FR-002) | Per-command inverses need code for every edit type; full reload on undo breaks object identity used by the processor and audio subscriptions (R1) |
| `"inherit"` as a third target state | Track targets must apply live (user decision 3) | Copy-on-drop is the current behaviour the user wants replaced; a separate boolean can contradict `target` (R3) |
