# Feature Specification: Timeline UX Redesign

**Feature Branch**: `main` (no feature branch, see project convention)

**Created**: 2026-11-15

**Status**: Implemented (manual verification in the desktop build pending)

**Input**: User description: "Timeline UX redesign. Missing today: box select, copy & paste. The right-click to select a target is tedious. On short clips it is hard to see whether a target has been selected or any other information, although most clips have a lot of blank space. Add what else users would expect." Design decisions were agreed in the preceding brainstorm: undo scope is whatever is simplest (a timeline-only history is fine); pasted clips stay linked to their library item; track targets become a live "inherit" default; the clip inspector lives inside the timeline panel.

## Context

The timeline is where users arrange audio, patterns, automations, graphs, scripts, looks and effects into a show. It works for placing and moving single clips, but larger edits are slow and error-prone:

- Selection is limited to click and Ctrl+click. There is no box select, select all or range select.
- There is no copy, paste, duplicate or undo. A wrong drag or delete cannot be reverted.
- Assigning a target to a look, effect or graph clip takes a right-click, a menu entry and a modal dialog, for one clip at a time. The track's default target is copied into a clip once, when it is dropped. Changing the track's target later does not update existing clips, and the track header does not show the target.
- Clips are 100 px tall but show their information on one small line at the top. On short clips the target, which comes last on that line, is cut off first. A clip without a target looks the same as one with a target.
- The mouse wheel always zooms. You cannot scroll with the wheel at all, so with many tracks you have to use the scrollbars.
- Clips on the same track may overlap and hide each other.
- Known bug: dragging a selection below the last track crashes the drag.

## Glossary

- **Clip**: an item on the timeline that refers to a library item (audio, pattern, automation, graph, script, look, effect) and has a start, a length and, depending on its type, a target and fades.
- **Targetable clip**: a look, effect or graph clip. These are the clip types that have a target.
- **Linked clip**: every clip refers to a library item. Several clips may refer to the same item, and editing that item changes all of them.
- **Explicit target**: a group or fixture set directly on a clip.
- **Inherit**: the clip uses whatever target its track currently has. This is the default for new clips.
- **None**: the clip deliberately has no target, even if its track has one.
- **Effective target**: what a clip actually programs. That is the explicit target, or the track's target when the clip inherits, or nothing.
- **Snap unit**: the grid size chosen in the timeline toolbar (e.g. 1/4 beat).
- **Clip inspector**: a strip inside the timeline panel that shows and edits the properties of the selected clips.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Undo mistakes and edit safely (Priority: P1)

A user moves, deletes or resizes clips and makes a mistake. They press Ctrl+Z and the timeline returns to the state before the edit. Ctrl+Y or Ctrl+Shift+Z redoes it. Normal keys keep working when the timeline has focus, and dragging clips below the last track no longer breaks anything.

**Why this priority**: every other story makes it possible to change many clips at once. Without undo, one wrong paste or box-select delete can destroy work that cannot be recovered.

**Independent Test**: move, resize, delete and add clips, change a target and fades, then undo and redo each step. The timeline must match the earlier state exactly.

**Acceptance Scenarios**:

1. **Given** a clip was moved by dragging, **When** the user presses Ctrl+Z, **Then** the clip returns to its previous start and track in a single step, no matter how many intermediate positions the drag went through.
2. **Given** three clips were deleted together, **When** the user presses Ctrl+Z, **Then** all three come back with their previous positions, tracks, targets and fades.
3. **Given** an undone edit, **When** the user presses Ctrl+Y or Ctrl+Shift+Z, **Then** the edit is applied again.
4. **Given** an undone edit, **When** the user makes a new edit, **Then** the redo history is cleared.
5. **Given** a multi-clip selection spanning several tracks, **When** the user drags it below the last track, **Then** the selection stops at the last track and nothing crashes.

---

### User Story 2 - Select many clips quickly (Priority: P1)

A user wants to change a whole section of the show. They drag a rectangle over empty space to select every clip it touches, add more clips with Shift, toggle single clips with Ctrl, or select all with Ctrl+A. Then they move or delete the selection as a group.

**Why this priority**: this is one of the two features the user explicitly asked for. Clipboard, multi-edit and nudging all build on it.

**Independent Test**: build a timeline with clips on several tracks, then use box select, Shift, Ctrl, Shift+click range, Ctrl+A and Esc. Check which clips are highlighted after each action.

**Acceptance Scenarios**:

1. **Given** no selection, **When** the user drags from an empty spot on a track across several clips on several tracks, **Then** a visible rectangle follows the mouse and every clip it touches is selected on release.
2. **Given** an existing selection, **When** the user box-selects with Shift held, **Then** the new clips are added to the selection. **When** they box-select with Ctrl held, **Then** each touched clip's selection is toggled.
3. **Given** one selected clip, **When** the user Shift+clicks another clip on the same track, **Then** both clips and every clip between them on that track are selected.
4. **Given** any state, **When** the user presses Ctrl+A, **Then** all clips are selected. **When** they press Esc, **Then** nothing is selected.
5. **Given** a clip, **When** the user double-clicks it, **Then** its library item opens in the editor above the timeline.
6. **Given** a selection, **When** the user clicks empty track space without dragging, **Then** the selection is cleared.

---

### User Story 3 - Copy, paste and duplicate clips (Priority: P1)

A user programmed a 4-bar sequence of looks and effects over three tracks and wants it again for the next chorus. They select it, press Ctrl+C, move the playhead and press Ctrl+V. The sequence appears at the playhead with the same spacing and the same track layout. Ctrl+D repeats the selection directly after itself, and Alt+drag drags a copy instead of the original.

**Why this priority**: this is the second feature the user explicitly asked for. Light shows are built from repeated sections.

**Independent Test**: copy a multi-track selection, paste it at different positions and onto a different hovered track, use Ctrl+D and Alt+drag. Edit the library item of one pasted clip and check that the original changes too.

**Acceptance Scenarios**:

1. **Given** clips on tracks 2 and 3 are copied, **When** the user pastes with the mouse over track 4, **Then** the copies start at the playhead, keep their time offsets to each other, and land on tracks 4 and 5.
2. **Given** a paste would need more tracks than exist below the target track, **When** the user pastes, **Then** new tracks are created for the remaining clips.
3. **Given** a selection, **When** the user presses Ctrl+X, **Then** the clips are removed and can be pasted later.
4. **Given** a selection, **When** the user presses Ctrl+D, **Then** a copy starts exactly where the selection ends, on the same tracks, and becomes the new selection.
5. **Given** a selection, **When** the user Alt+drags it, **Then** the originals stay where they were and the copies end up where the mouse is released.
6. **Given** a pasted clip, **When** the user edits its look in the editor, **Then** the original clip changes the same way, because both are linked to the same library item.
7. **Given** a selected clip, **When** the user chooses "Make unique", **Then** the library item is duplicated, the clip refers to the copy, and later edits no longer affect the other clips.
8. **Given** pasted clips, **When** the paste finishes, **Then** the pasted clips are the new selection and keep their targets (explicit, inherit or none) and fades.

---

### User Story 4 - Assign targets fast and for many clips at once (Priority: P1)

A user has twelve effect clips that should all program the "Front Truss" group. They select them and choose the group once in the clip inspector strip. For a single clip, they click the target chip on the clip and pick a group from the dropdown that opens there. Usually they don't need to do either: they set "Front Truss" as the track's target, and every clip on the track that inherits follows it, including clips added earlier.

**Why this priority**: the user named target assignment as tedious. It is the most common edit for looks and effects.

**Independent Test**: set a track target, add clips, change the track target and check that inheriting clips follow. Use the target chip on one clip, then use the inspector on a multi-selection with different targets.

**Acceptance Scenarios**:

1. **Given** a track with target "Front Truss", **When** a look is dropped onto it, **Then** the clip inherits and its effective target is "Front Truss".
2. **Given** inheriting clips on a track, **When** the user changes the track's target to "Back Truss", **Then** all inheriting clips now program "Back Truss". Clips with an explicit target or "none" are unchanged.
3. **Given** a targetable clip, **When** the user clicks its target chip, **Then** a dropdown with "Inherit (track target)", "None" and all groups and fixtures opens at the clip. Picking an entry applies it immediately.
4. **Given** several selected clips with different targets, **When** the inspector strip is shown, **Then** the target field shows "Mixed". **When** the user picks a target there, **Then** all selected targetable clips get it in a single undoable step. Selected clips that cannot have a target are left unchanged.
5. **Given** a track header, **When** the user looks at it, **Then** it shows the track's target as a chip. Clicking the chip lets them change it without opening the track settings dialog.
6. **Given** a project saved before this feature, **When** it is opened, **Then** clips that had a target keep it as an explicit target, and clips without a target are set to "none". Playback is unchanged.

---

### User Story 5 - Read clip information at a glance (Priority: P2)

Looking at the timeline, a user immediately sees which clips program which group and which clips have no target, even on short clips. Wide clips use their height for name, target, summary and a preview. Narrow clips still show the target colour. Hovering any clip shows all its details.

**Why this priority**: the user reported that on short clips they cannot tell whether a target is set. Seeing it at a glance prevents mistakes that only show up during playback.

**Independent Test**: create targetable clips with different targets, inherit and none, at different widths and zoom levels. Check the colours, the "no target" marking, the layouts and the tooltips.

**Acceptance Scenarios**:

1. **Given** clips with different effective targets, **When** they are displayed, **Then** each target has its own colour, shown on the clip, and clips with the same target share it.
2. **Given** a targetable clip with no effective target, **When** it is displayed, **Then** it is marked by a hatched background and a warning icon at every width.
3. **Given** a look or effect clip at least 120 px wide, **When** it is displayed, **Then** name, target chip, summary and preview are shown on separate lines. **Given** a clip 40–120 px wide, **Then** name and target chip are shown. **Given** a clip narrower than 40 px, **Then** only the target colour and the first letter of the name are shown.
4. **Given** any clip, **When** the user hovers over it, **Then** a tooltip shows the name, type, effective target (and whether it is inherited), start, and length in beats and seconds, plus fades for clips that have them.
5. **Given** a look or effect clip that is neither hovered nor selected, **When** it is displayed, **Then** the fade handles are hidden while the fade shape stays visible.
6. **Given** an effect clip, **When** it is displayed, **Then** its shape is drawn across the full clip body, repeated once per cycle at the effect's rate.
7. **Given** an inheriting clip, **When** it is displayed, **Then** its target chip looks visibly different from an explicit target (e.g. muted or marked "track").

---

### User Story 6 - Navigate the timeline (Priority: P2)

A user scrolls through a long show with the mouse wheel, scrolls sideways with Shift+wheel and zooms with Ctrl+wheel around the mouse position. One command fits the whole show into view. During playback the view follows the playhead. A readout in the toolbar shows the playhead position as bar.beat and as minutes:seconds.

**Why this priority**: today the wheel only zooms, so you can't scroll with the mouse at all, and that gets worse as shows grow.

**Independent Test**: create a timeline with more tracks and length than fit on screen. Scroll, zoom, fit to view, play with follow mode on, and read the position display.

**Acceptance Scenarios**:

1. **Given** the timeline has focus or is hovered, **When** the user scrolls the wheel, **Then** the view scrolls vertically. With Shift, it scrolls horizontally. With Ctrl, it zooms and the time under the mouse stays in place.
2. **Given** any zoom level, **When** the user triggers "zoom to fit", **Then** the zoom and scroll show the whole show from 0 to the end of the last clip.
3. **Given** follow mode is on and playback is running, **When** the playhead reaches the right edge of the view, **Then** the view moves so the playhead stays visible. Scrolling by hand while playing turns follow mode off.
4. **Given** the playhead at bar 5, beat 3 at 120 BPM, **When** the user looks at the toolbar, **Then** it shows "5.3" and "0:09".
5. **Given** the user drags clips or a selection rectangle near the edge of the view, **When** the mouse stays there, **Then** the view scrolls in that direction.

---

### User Story 7 - Precise editing: nudge, snapping, no overlaps (Priority: P3)

A user fine-tunes the timing of the show. They nudge the selection with the arrow keys. While dragging, clips snap to the edges of other clips and to the playhead as well as to the grid, and holding Alt turns snapping off. Clips on the same track never overlap.

**Why this priority**: these speed up detail work but are not blocking. The main pain points are covered by P1 and P2.

**Independent Test**: nudge with arrows and Shift+arrows, drag near other clip edges with and without Alt, try to drop and move clips onto occupied space.

**Acceptance Scenarios**:

1. **Given** a selection, **When** the user presses Left or Right, **Then** the selection moves by one snap unit (by the smallest timeline step if snapping is disabled). With Shift, it moves by one bar. Up and Down move the selection to the previous or next track.
2. **Given** a clip is dragged so that one of its edges comes within 8 px of another clip's edge or the playhead, **When** dragging continues, **Then** the edge snaps to it. Holding Alt during the drag turns all snapping off, including the grid.
3. **Given** a move, resize, nudge or paste would make a clip overlap another clip on the same track, **When** the user completes the action, **Then** the clip is placed directly against the obstacle in the direction it was moving. If there is no room, the action is rejected and the clip goes back.
4. **Given** an audio clip, **When** the user tries to resize it, **Then** the action is not available, as audio clips have a fixed length.

---

### Edge Cases

- Pasting with an empty clipboard, or pressing Ctrl+D with nothing selected, does nothing.
- Pasting clips whose library item has been deleted in the meantime skips those clips. The rest are pasted.
- Copying and pasting between projects is not supported. The clipboard is cleared when another project is loaded.
- Box select that starts on a clip starts a clip drag instead. Box select only starts on empty track space, never on the ruler or track headers.
- A box select that touches no clips, without Shift or Ctrl, clears the selection.
- Deleting a group or fixture that clips target explicitly: those clips show the "no target" marking and warning. They are not silently changed to inherit.
- Deleting a track's target group: inheriting clips on that track show the "no target" marking.
- Moving an inheriting clip to another track: it now inherits the new track's target. Its colour and chip update while dragging.
- Inspector with a selection of only non-targetable clips (e.g. audio): the target field is hidden. Start, length and source are shown. Fades are shown only when all selected clips support fades.
- Inspector with mixed values in start, length or fades: the field shows "Mixed". Entering a value sets it on all selected clips. Length and fades are clamped per clip as they are today.
- Editing start in the inspector for a multi-selection sets every clip to that start. Use nudge or drag to move clips relative to each other.
- A typing field (inspector input, track name, dialogs) has focus: timeline shortcuts (Delete, S, arrows, Ctrl+A, Ctrl+C/V…) do not fire, so normal text editing works.
- Undo after a library item was deleted: clips of deleted library items cannot be restored. Undo entries that only concern them are skipped.
- Very short clips at low zoom (narrower than about 4 px) still show at least the target colour and are still selectable.
- Overlap prevention when loading an old project that already contains overlapping clips: the clips are loaded as they are and are not moved. The rule applies only to new edits.

## Requirements *(mandatory)*

### Functional Requirements

**Foundations**

- **FR-001**: The timeline MUST keep a single selection of clips that the drag, clipboard, inspector, nudge and delete actions all use.
- **FR-002**: Users MUST be able to undo and redo timeline edits with Ctrl+Z and Ctrl+Y / Ctrl+Shift+Z, and with buttons in the timeline toolbar. Covered edits: adding, removing, moving, resizing and pasting clips; changing a clip's target and fades; "Make unique"; adding, removing, renaming and reordering tracks; changing a track's target.
- **FR-003**: A continuous gesture (drag, fade drag, rectangle select) MUST create at most one undo step, recorded when the gesture ends.
- **FR-004**: The undo history MUST hold at least 100 steps and MUST be cleared when a project is loaded or reset. Changes outside the timeline (library item contents, scene, stage) are not part of this history.
- **FR-005**: Timeline keyboard shortcuts MUST only suppress the browser's default behaviour for keys they actually handle, and MUST NOT fire while a text input has focus.
- **FR-006**: Dragging a selection across tracks MUST keep every clip within the existing tracks.

**Selection**

- **FR-007**: Click MUST select one clip. Ctrl+click MUST toggle a clip. Shift+click MUST select the range between the last clicked clip and the clicked clip on the same track.
- **FR-008**: Dragging on empty track space MUST draw a selection rectangle. On release, it selects every clip it touches: it replaces the selection, adds to it with Shift, or toggles with Ctrl.
- **FR-009**: Ctrl+A MUST select all clips. Esc MUST clear the selection. A click on empty track space without dragging MUST clear the selection.
- **FR-010**: Double-clicking a clip MUST open its library item in the editor and select it in the library.
- **FR-011**: Delete and Backspace MUST remove the selected clips.

**Clipboard**

- **FR-012**: Ctrl+C MUST copy the selected clips. Ctrl+X MUST copy and remove them.
- **FR-013**: Ctrl+V MUST paste the clipboard so that the earliest clip starts at the playhead and the topmost clip lands on the hovered track. If no track is hovered, it lands on the topmost track of the original selection. Time offsets and track offsets between clips MUST be kept. New tracks MUST be created when needed.
- **FR-014**: Ctrl+D MUST duplicate the selection so that the copy starts at the end of the selection, on the same tracks.
- **FR-015**: Holding Alt when starting a clip drag MUST drag copies and leave the originals in place.
- **FR-016**: Copies MUST refer to the same library item as the original and keep their target setting (explicit, inherit or none) and fades. After paste, duplicate or Alt+drag, the copies MUST be the selection.
- **FR-017**: A "Make unique" command, available in the clip context menu and the inspector, MUST duplicate the library item of each selected clip and point the clip to the copy. Selected clips that share an item MUST end up sharing one new copy.

**Targets**

- **FR-018**: A targetable clip's target MUST be one of: inherit, none, or a specific group or fixture. New clips MUST default to inherit.
- **FR-019**: The effective target of an inheriting clip MUST always follow its track's current target, including after the track's target changes and after the clip moves to another track.
- **FR-020**: When a project saved before this feature is loaded, clips with a stored target MUST keep it as an explicit target, and targetable clips without one MUST become "none". Playback MUST be unchanged.
- **FR-021**: Each targetable clip MUST show a target chip. Clicking it MUST open a dropdown at the clip offering Inherit, None and all groups and fixtures, applying the choice immediately.
- **FR-022**: The track header MUST show the track's target as a chip that can be changed in place.
- **FR-023**: The existing right-click "Target…" dialog MUST be replaced by the chip and the inspector. The context menu MUST still offer Target (as a submenu), Make unique, Copy, Duplicate and Delete.

**Clip inspector**

- **FR-024**: When at least one clip is selected, the timeline panel MUST show an inspector strip with: number of selected clips, source library item (with an action to open it in the editor), target, start, length and fade in/out. Fields that do not apply to the selection MUST be hidden.
- **FR-025**: Fields whose values differ across the selection MUST show "Mixed". Entering a value MUST apply it to every selected clip that supports it, as one undo step.
- **FR-026**: Start and length MUST be entered and shown in bars.beats (with fractions according to the snap unit). Fades MUST be shown in beats.
- **FR-027**: The inspector MUST NOT reduce the visible track area while nothing is selected.

**Clip visuals**

- **FR-028**: Each group and fixture MUST be shown with a consistent colour on every clip that targets it. The colour MUST be the same every time the project is opened.
- **FR-029**: Targetable clips without an effective target MUST be shown with a hatched background and a warning icon at every width.
- **FR-030**: Clips MUST adapt their content to their on-screen width with three layouts: wide (≥ 120 px: name, target chip, summary, preview), medium (40–120 px: name, target chip), narrow (< 40 px: target colour and first letter of the name).
- **FR-031**: Hovering over a clip MUST show a tooltip with name, type, effective target (with "inherited from track" when applicable), start, length in beats and seconds, and fades if any.
- **FR-032**: Fade handles MUST only be visible while the clip is hovered or selected. The fade shape MUST stay visible.
- **FR-033**: Effect clips MUST draw the effect shape across the clip body, one cycle per effect period.
- **FR-034**: A clip that inherits its target MUST be visually distinguishable from one with an explicit target.

**Navigation**

- **FR-035**: The mouse wheel MUST scroll vertically, Shift+wheel MUST scroll horizontally, and Ctrl+wheel MUST zoom, keeping the time under the mouse in place.
- **FR-036**: A "zoom to fit" toolbar action MUST show the whole show in view.
- **FR-037**: A "follow playhead" toggle in the toolbar MUST keep the playhead visible during playback. It MUST turn off when the user scrolls by hand during playback.
- **FR-038**: Dragging clips, fade handles or the selection rectangle near the edge of the view MUST scroll the view.
- **FR-039**: The toolbar MUST show the playhead position as bar.beat and as minutes:seconds, updated during playback.

**Precise editing**

- **FR-040**: Left and Right MUST nudge the selection by one snap unit; with Shift, by one bar. Up and Down MUST move the selection to the previous or next track, within the existing tracks.
- **FR-041**: *(removed: split at playhead, see Assumptions → Out of scope)*
- **FR-042**: When moving or resizing, clip edges MUST snap to the edges of other clips and to the playhead when within 8 px, in addition to the grid.
- **FR-043**: Holding Alt during a drag or resize MUST turn off all snapping for that gesture. (Alt pressed at the start of a center drag also means copy, see FR-015; both apply.)
- **FR-044**: New edits (move, resize, nudge, paste, duplicate, drop) MUST NOT produce overlapping clips on the same track. The clip MUST stop against the neighbouring clip, or the edit MUST be rejected if there is no room. Clips that only touch (one ends where the next starts) are not overlapping.
- **FR-045**: When dropping a library item onto an occupied spot, the existing behaviour (use another free track or create one) MUST be kept, with touching clips counted as free.

### Key Entities

- **Clip**: refers to a library item; has track, start, length, target setting (inherit, none, or a group/fixture), fade-in and fade-out. New: the target setting distinguishes inherit from none.
- **Track**: name, order and target. The target is now applied live to inheriting clips instead of being copied when a clip is dropped.
- **Selection**: the set of selected clips, plus the last clicked clip for Shift+click ranges. Not saved with the project.
- **Clipboard**: copied clips with their offsets relative to the earliest clip and the topmost track, and references to their library items. Not saved with the project. Cleared when another project is loaded.
- **Undo history**: ordered list of reversible timeline edits with a current position. Not saved with the project.
- **Target colour**: a colour derived from a group or fixture. It is stable across sessions without the user having to choose one.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Assigning the same target to 10 existing clips takes at most 3 user actions (box select, open target field, choose target). Today it takes about 30.
- **SC-002**: Repeating a 4-bar, multi-track section at a new position takes at most 4 user actions (select, copy, set playhead, paste).
- **SC-003**: At any zoom level where a clip is at least 4 px wide, a user can tell within 2 seconds whether that clip has a target and which group it is, using the colour and tooltip.
- **SC-004**: Every edit listed in FR-002 can be undone and redone, and after undoing all steps the timeline equals the state at project load.
- **SC-005**: Opening a project saved before this feature produces identical light output during playback.
- **SC-006**: A user can reach any part of a timeline with 20 tracks and 5 minutes of content using only the mouse wheel (with or without modifiers), without touching a scrollbar.
- **SC-007**: Interactions stay smooth (no visible lag while dragging, box-selecting or scrolling) with 500 clips in the timeline.

## Manual Verification *(required by constitution, principle III)*

Run each step in **both** the desktop (Electron) and the browser build.

1. **Undo and drag bug**: create 3 tracks with clips. Move a clip, resize one, delete two together, change a target and a fade. Undo each step with Ctrl+Z, redo with Ctrl+Y. Expected: each step reverts and reapplies exactly, a whole drag is one step. Select clips on tracks 2 and 3 and drag them far below the last track. Expected: they stop at the last track, no error in the console.
2. **Selection**: with clips on 4 tracks, box-select across 3 tracks; Shift+box-select more; Ctrl+box-select to toggle some; Shift+click a range on one track; Ctrl+A; Esc. Expected: highlighted clips match each action. Double-click a look clip. Expected: the look opens in the editor.
3. **Clipboard**: select a section on tracks 2–3, Ctrl+C, move the playhead, hover track 4 (the last track), Ctrl+V. Expected: copies at the playhead on track 4 and a new track 5, same spacing. Ctrl+D on a selection. Expected: copy directly after it. Alt+drag a clip. Expected: original stays. Edit the look of a pasted clip. Expected: the original changes too. "Make unique" on it and edit again. Expected: the original no longer changes.
4. **Targets**: set track 1's target to group A and drop two looks on it. Expected: both program group A, chips marked as inherited. Change the track target to group B. Expected: both follow. Use one clip's chip to choose group A explicitly, and set the other to None. Change the track target again. Expected: neither follows; the "none" clip is hatched with a warning. Box-select 10 effect clips with different targets. Expected: inspector shows "Mixed"; choosing a group sets all 10, and one Ctrl+Z reverts all 10.
5. **Old project**: open a project saved before this feature that contains clips with and without targets. Expected: same light output in the 3D preview as before; clips without a target show the "no target" marking.
6. **Visuals**: create clips with 3 different targets at widths of about 200 px, 80 px and 20 px (change zoom). Expected: wide/medium/narrow layouts, the same colour per target everywhere, tooltips with full details, fade handles only on hover or selection, effect shape across the whole clip.
7. **Navigation**: with 20 tracks and a long show, scroll with the wheel, Shift+wheel and Ctrl+wheel. Expected: vertical scroll, horizontal scroll, zoom around the mouse position. Zoom to fit. Expected: whole show visible. Play with follow mode on. Expected: the view follows; scrolling by hand turns follow off. Check that the position readout matches the ruler.
8. **Precise editing**: nudge a selection with arrows and Shift+arrows, move it with Up/Down. Drag a clip near another clip's edge. Expected: it snaps; with Alt held, it does not. Try to move a clip onto another clip on the same track. Expected: it stops against it, or the move is rejected if there is no room.
9. **Typing**: rename a track and type into an inspector field, using Delete, Backspace, arrows and Ctrl+A. Expected: only the text field reacts; no clips are deleted or moved.

## Assumptions

- **Undo scope**: a timeline-only undo history, as decided ("whatever is easier"). Edits inside the editor pane (look values, graph nodes, patterns) and in the scene or stage are not undoable through it.
- **Linked copies**: pasted and duplicated clips stay linked to the same library item, as decided. "Make unique" is the explicit way to break the link.
- **Migration**: by constitution principle IV, migrations are optional before 1.0. FR-020 is included anyway because it is small and keeps existing shows playing the same. It is the only file-format concession.
- **Target colours** are derived automatically (e.g. from the group or fixture identity). Users cannot pick colours in this feature, since groups have no colour property today.
- **Track targets** keep the existing set of choices (any group or fixture). Picking "inherit" on a track is not possible; tracks have a target or none.
- **Thresholds** (120 px / 40 px layout breakpoints, 8 px magnetic snap, 100 undo steps) are starting values and may be adjusted during implementation if they feel wrong.
- **Shortcuts on macOS** use Cmd instead of Ctrl, and Option instead of Alt.
- **Out of scope** (planned for later): markers/cue points, loop region, track mute/solo/lock/colour/collapse/height, ripple delete, clip grouping, minimap.
- **Split at playhead** was removed during planning: every clip type plays its content relative to the clip start, so a correct split would need a source-offset field threaded through playback and all previews. Not worth the complexity for now.
- **Also out of scope**: assigning targets by dragging a group or fixture onto a clip. The Programming view currently has no group or fixture list to drag from, and the chip plus inspector already cover the need. It can be added together with a target palette later.
