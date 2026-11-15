# Quickstart: Validating the Timeline UX Redesign

Validation guide for feature 005. Covers the spec's Manual Verification and the design decisions in [research.md](./research.md). Interaction details: [contracts/timeline-ui.md](./contracts/timeline-ui.md).

## Prerequisites

- `pnpm install`
- Browser target: `pnpm dev`, then open `http://localhost:3000`
- Desktop target: `pnpm electron:dev`
- Quality gates before committing: `pnpm lint` and `pnpm build`
- A test project with:
  - at least 2 DMX fixtures and 2 groups (A, B), set up in the Stage view
  - library items: 1 audio file, 1 pattern, 1 automation, 1 graph with keyframes, 2 looks (one with fades), 2 effects
- An **old project** saved before this feature, with clips that have targets and clips that don't. Keep a copy, because saving converts it.

Run every scenario in both targets.

## Scenarios

| # | Scenario | Steps | Expected |
|---|---|---|---|
| Q1 | Undo granularity | Drag a clip across 3 tracks and back with many mouse moves; Ctrl+Z | One step restores the original position |
| Q2 | Undo coverage | Do each: add (drop), delete, move, resize, paste, Make unique, target change, fade drag, inspector edit, track add/remove/rename/reorder, track target. Then undo all, redo all | Each step reverts and reapplies; after undoing all, the timeline equals the loaded state (SC-004) |
| Q3 | Undo with audio and BPM | Move an audio clip, change BPM, Ctrl+Z | The clip returns to the old start with the length for the **current** BPM; audio plays at the right place |
| Q4 | Drag clamp bug | Select clips on the last 2 tracks, drag far below the panel | Clips stop at the last track, no console error (FR-006) |
| Q5 | Box select | Drag over clips on 3 tracks; Shift+drag; Ctrl+drag; click empty space | Live rectangle; replace/add/toggle; click clears |
| Q6 | Range, all, open | Shift+click on the same track; Ctrl+A; Esc; double-click a look | Range selected; all; none; look opens in the editor |
| Q7 | Paste layout | Copy clips on tracks 2–3, playhead at bar 9, hover the last track, Ctrl+V | Copies start at bar 9, keep spacing; a new track is created for the second row |
| Q8 | Duplicate and Alt+drag | Ctrl+D; Alt+drag | Copy directly after the selection; originals stay in place with Alt |
| Q9 | Linked vs unique | Edit the look of a pasted clip; then Make unique and edit again | First: both change. After Make unique: only the unique one changes; library shows "<name> (copy)" |
| Q10 | Inherit | Track target A, drop a look, change the track target to B, move the clip to a track with target C | The clip programs A → B → C in the 3D preview, chip muted with "· track" |
| Q11 | Explicit and none | Chip → group A on one clip, None on another; change the track target | Neither follows; the "none" clip is hatched with a warning |
| Q12 | Multi-edit | Box-select 10 effects with different targets; inspector target → B; Ctrl+Z | "Mixed" shown; all 10 → B in one step; one undo reverts all |
| Q13 | Old project | Open the old project, play it | Same light output as before (SC-005); untargeted clips hatched |
| Q14 | Overlap prevention | Drag a clip onto another on the same track; nudge into a neighbour; resize into a neighbour; paste onto occupied space | It stops flush / jumps past when there is room; resize clamps; touching clips are allowed |
| Q15 | Snapping | Drag near another clip's edge and near the playhead; repeat holding Alt; drag a selection of off-grid clips with a 1-beat grid | Snaps within ~8 px; no snapping with Alt; spacing between off-grid clips stays the same |
| Q16 | Layouts and colours | Zoom so clips are ~200, ~80 and ~20 px wide; hover clips | Wide/medium/narrow layouts; same colour per target everywhere; tooltip with beats and seconds; fade handles only on hover/selection; effect shape repeats across the clip |
| Q17 | Navigation | 20 tracks, 5 min: wheel, Shift+wheel, Ctrl+wheel, Zoom to fit | Vertical, horizontal, zoom anchored at the mouse, whole show visible (SC-006); browser page zoom does not trigger |
| Q18 | Follow and auto-scroll | Enable follow, play; scroll manually while playing; drag a clip to the right edge and hold | The view pages with the playhead; manual scroll turns follow off; auto-scroll moves the view and the clip stays under the pointer |
| Q19 | Position readout | 120 BPM, playhead at bar 5 beat 3 | "5.3" and "0:09" |
| Q20 | Typing safety | Type in the inspector start field and a track name, using Delete, Backspace, arrows, Ctrl+A, Ctrl+Z | Only the text field reacts |
| Q21 | Performance | Project with 500 clips: box-select all, drag, scroll, zoom | No visible lag (SC-007) |
| Q22 | Alt in Electron | In the desktop build, Alt+drag a clip and press Alt alone with the timeline focused | No menu-bar focus steal; the drag copies |

## Results (2026-11-15, implementation run)

Browser build (`pnpm dev`, Chromium), driven by scripted DOM events against a seeded test project (2 groups, looks/effects, no fixtures/audio). **Desktop build not yet run.**

| # | Result | Notes |
|---|---|---|
| Q1 | ✅ | One drag = one "Move" step |
| Q2 | ✅ partial | Verified: drop, delete, move, resize, paste, duplicate, cut, nudge, move to track, Make unique, target (chip, context menu, inspector), fade drag, inspector start/length, track target. Not exercised: track add/remove/rename/reorder through the UI (same `edit()` wrapper) |
| Q3 | ⏳ | Needs an audio file |
| Q4 | ✅ | Dragging 2000 px below clamps to the last track, no error |
| Q5 | ✅ | Live rectangle, replace; click on empty space clears |
| Q6 | ✅ partial | Ctrl+click toggle, Ctrl+A, Esc verified; double-click needs a real mouse |
| Q7 | ✅ partial | Paste at playhead on hovered track, keeps clip/target; multi-track paste creating tracks not exercised |
| Q8 | ✅ | Ctrl+D places directly after; Alt+drag leaves original, one "Copy clips" step |
| Q9 | ✅ partial | Make unique creates "<name> (copy)" shared per group; undo re-links clips (library copy stays) |
| Q10 | ✅ partial | Chip follows the track target live and through undo; 3D output not checked (no fixtures) |
| Q11 | ✅ | No-target clips are hatched with a warning |
| Q12 | ✅ partial | "Mixed" shown; multi-edit is one step |
| Q13 | ⏳ | Needs an old project |
| Q14 | ✅ | Drag stops flush / jumps past; resize clamps at neighbour; inspector start respects neighbours |
| Q15 | ⏳ | Magnetic math covered by a scripted check; real-mouse check pending |
| Q16 | ✅ | Wide/medium/narrow layouts, colours, hatching, full-width effect wave, lazy tooltip (native title) |
| Q17 | ✅ partial | Ctrl+wheel zooms and prevents page zoom; plain wheel scrolls natively; Zoom to fit |
| Q18 | ⏳ | Needs playback |
| Q19 | ✅ | 384 ticks @130 BPM → "5.1 · 0:07"; 432 @120 → "5.3"/"0:09" (scripted) |
| Q20 | ✅ partial | Delete inside the inspector input does not delete clips |
| Q21 | ⚠️ | 500 clips: box select ~40 ms/frame; dragging **all 500** at once ~55–85 ms per update (Vue re-rendering 500 clips). Dragging a few clips is instant |
| Q22 | ⏳ | Electron only |

Deviation: the clip tooltip is a native `title` set only while hovered, instead of PrimeVue `v-tooltip` (the directive rebinds its listeners on every clip re-render and cost ~40 ms per drag frame with 500 clips).
