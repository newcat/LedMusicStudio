# Feature Specification: Scene Model & 3D Scene Editor

**Feature Branch**: `main` (no feature branch, see project convention)

**Created**: 2026-11-07

**Status**: Draft

**Input**: User description: "Scene model + 3D scene editor for the stage visualization (feature 1 of 3; asset library and rendering upgrades follow as separate features)."

## Context

Today, the static stage scene can only be imported as an externally created file and cannot be edited inside the app. The camera is fixed to whatever the imported file contains, and fixtures are positioned exclusively by typing coordinates into forms in a different part of the app than the 3D view. Each fixture visualization type uses a different placement scheme (position + rotation, position + target, start/end/direction), and there is no way to see which 3D object belongs to which fixture.

This feature makes the scene a first-class part of the project and adds an interactive editor so users can build and arrange their stage directly in the 3D view. It is the first of three related features:

1. **Scene model & editor** (this spec)
2. Asset library & model contract (fixture, stage construction and decoration models)
3. Rendering & fixture capability upgrades (dimmer, strobe, zoom, haze, lasers, LED pixel rendering, ...)

This feature defines the scene structure that features 2 and 3 build on. It ships with a small set of basic shapes so that a usable stage can be built before the asset library exists.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Navigate and view the stage in an embedded 3D editor (Priority: P1)

A user opens the Visualization tab of the Stage view and sees an interactive 3D view of their stage directly in the main window. A new project already contains a ground floor, so the view is never empty. The user can orbit around the stage, pan, zoom, switch to top/front/side views, and jump the camera to a selected object.

**Why this priority**: Every other editing capability depends on being able to see and navigate the scene inside the app. On its own it already removes the "No scene loaded" dead end and the fixed camera.

**Independent Test**: Create a new project, open the Visualization tab, and navigate the default scene with mouse and keyboard; existing fixture visualizations are visible and react to playback.

**Acceptance Scenarios**:

1. **Given** a new, empty project, **When** the user opens the Visualization tab, **Then** a 3D view with a ground floor, a reference grid and a default camera position is shown, with no "No scene loaded" message.
2. **Given** the 3D editor is open, **When** the user drags with the orbit mouse button, pans or scrolls, **Then** the camera orbits, pans or zooms smoothly around the stage.
3. **Given** the 3D editor is open, **When** the user chooses "Top", "Front", "Side" or "Perspective" view, **Then** the camera switches to that view.
4. **Given** an object is selected, **When** the user triggers "Focus selection", **Then** the camera moves so that the object fills a large part of the view.
5. **Given** a project with fixture visualizations is playing, **When** the camera is moved, **Then** light beams and other effects keep rendering correctly from the new viewpoint.

---

### User Story 2 - Place and arrange fixtures directly in 3D (Priority: P1)

A user selects a fixture visualization by clicking it in the 3D view (or in the scene outliner) and moves and rotates it with on-screen handles, optionally snapping to a grid or angle steps. The selected object is highlighted and its name is shown. Exact values can still be typed into an inspector panel. All fixture visualization types are placed the same way.

**Why this priority**: Placing fixtures by typing coordinates is the main pain point named by the user. Together with Story 1, this is the minimum viable editor.

**Independent Test**: Add a moving head and a spot visualization to two fixtures, then position both on the stage using only the mouse; reload the project and confirm the placement persists.

**Acceptance Scenarios**:

1. **Given** a fixture with a visualization exists, **When** the user clicks its 3D representation, **Then** it becomes selected, is visually highlighted, and an inspector shows its name, position, rotation and visualization settings.
2. **Given** an object is selected, **When** the user drags the move handle along an axis or plane, **Then** the object moves accordingly and the inspector values update live.
3. **Given** an object is selected and rotation mode is active, **When** the user drags the rotation handle, **Then** the object rotates around the chosen axis.
4. **Given** snapping is enabled with a 0.25 m grid and 15° angle step, **When** the user moves or rotates an object, **Then** positions land on multiples of 0.25 m and rotations on multiples of 15°.
5. **Given** an object is selected, **When** the user types a value into the inspector, **Then** the object updates in the 3D view immediately (no separate "Apply" step).
6. **Given** an LED strip visualization is selected, **When** the user drags its start or end handle, **Then** the strip's endpoints move independently, and its light direction can be set by rotating the strip.
7. **Given** a fixture is selected in the 3D editor, **When** the user chooses "Open fixture settings", **Then** the corresponding fixture's settings are shown; and selecting a fixture in the Fixtures list selects it in the 3D editor.

---

### User Story 3 - Build the static stage from basic shapes (Priority: P2)

A user adds basic shapes (box, cylinder, plane, sphere) to the scene to model the stage floor, risers, walls or a DJ table. They size, color and position each shape, give it a name, and the scene is saved with the project.

**Why this priority**: The static scene is currently not editable at all. Basic shapes let users build a meaningful stage before the asset library (feature 2) is available.

**Independent Test**: In a new project, build a stage platform (box), a back wall (plane) and a table (box) with distinct colors; save, close and reopen the project and confirm the scene is identical.

**Acceptance Scenarios**:

1. **Given** the 3D editor is open, **When** the user chooses "Add → Box", **Then** a box appears where the user clicks on an existing surface (or at the scene origin if no surface is hit) and is selected.
2. **Given** a shape is selected, **When** the user changes its dimensions in meters and its color in the inspector, **Then** the shape updates immediately.
3. **Given** a shape is selected and scale mode is active, **When** the user drags a scale handle, **Then** the shape is resized along that axis.
4. **Given** a scene with several shapes, **When** the project is saved and reopened, **Then** all shapes, names, dimensions, colors and transforms are restored exactly.
5. **Given** a scene has been built, **When** the user exports the stage and imports it into another project, **Then** the scene is included.

---

### User Story 4 - Organize the scene: outliner, grouping, mounting, editing safety (Priority: P2)

A user sees all scene objects (shapes, fixtures, imported models) in an outliner tree. They rename, hide, lock, duplicate, copy/paste and delete objects, select several at once, and nest objects (for example, attach fixtures to a bar so that moving the bar moves the fixtures with it). Every editing action can be undone and redone.

**Why this priority**: Makes editing larger scenes practical and safe, but the editor is usable without it.

**Independent Test**: Create a box "Truss", attach three moving heads to it via the outliner, move the box, and confirm the fixtures follow; undo the move and confirm everything returns.

**Acceptance Scenarios**:

1. **Given** a scene with objects, **When** the user opens the outliner, **Then** every object is listed by name in its parent/child hierarchy, and selecting an entry selects the object in 3D (and vice versa).
2. **Given** object B is dragged onto object A in the outliner, **When** A is moved or rotated, **Then** B moves and rotates with it while keeping its position relative to A, and B stays where it was in the world at the moment it was attached.
3. **Given** several objects are selected, **When** the user moves them, **Then** all selected objects move together.
4. **Given** an object is selected, **When** the user duplicates it, **Then** a copy (including children) appears slightly offset and is selected; a duplicated fixture visualization is not linked to a fixture until the user assigns one.
5. **Given** an object is locked, **When** the user clicks it in 3D, **Then** it cannot be selected or moved in the 3D view (it remains selectable in the outliner).
6. **Given** an object is hidden, **Then** it is not visible in either the editor or the show window.
7. **Given** any sequence of editing actions (add, delete, move, rotate, scale, rename, property change, reparent), **When** the user presses undo repeatedly, **Then** the actions are reverted in reverse order, and redo re-applies them.
8. **Given** the user deletes a fixture's visualization object in the scene, **Then** the fixture itself is not deleted; only its visualization is removed.

---

### User Story 5 - Show window on a second screen (Priority: P2)

A user opens the separate visualization window (for example on a second monitor or projector). It shows the same scene as the editor, without editing aids (no grid, handles, selection highlight or labels), from its own freely movable camera or a saved camera position. Changes made in the editor appear in the show window immediately.

**Why this priority**: Preserves today's separate-window use case while moving editing into the main window.

**Independent Test**: Open the show window, move an object in the editor, and confirm it moves in the show window within a moment; confirm the show window has no editing aids.

**Acceptance Scenarios**:

1. **Given** the show window is open, **When** the user edits the scene in the main window, **Then** the show window reflects the change within 0.5 seconds.
2. **Given** the show window is open, **Then** no grid, transform handles, selection highlights or labels are visible.
3. **Given** the show window is open, **When** the user orbits/pans/zooms in it or selects a saved camera position, **Then** only the show window's view changes; the scene cannot be edited from there.
4. **Given** the show window is opened after the project was loaded, **Then** it shows the current scene and the current fixture states.

---

### User Story 6 - Saved camera positions (Priority: P3)

A user saves named camera positions (e.g. "FOH", "Drone", "Stage left") and switches between them in the editor and in the show window.

**Why this priority**: Convenience for repeated viewing and show previews.

**Independent Test**: Save two camera positions, switch between them in both windows, reload the project, and confirm they persist.

**Acceptance Scenarios**:

1. **Given** the camera is at a position the user likes, **When** they choose "Save camera position" and enter a name, **Then** the position appears in the camera list.
2. **Given** saved positions exist, **When** the user selects one in the editor or show window, **Then** that window's camera moves to it.
3. **Given** saved positions exist, **When** the project is saved and reopened, **Then** they are restored; one of them can be marked as the show window's default view.

---

### User Story 7 - Import a custom 3D model (Priority: P3)

A user imports a 3D model file of their own (for example a model of their actual DJ booth) as a single scene object that can be positioned, scaled and organized like any other object. The model keeps its original colors and textures.

**Why this priority**: Gives an escape hatch for anything the built-in shapes and the later asset library don't cover, and replaces the removed scene-file import.

**Independent Test**: Import a textured model file, place and scale it, save and reopen the project, and confirm it renders identically, in both the desktop and the browser version.

**Acceptance Scenarios**:

1. **Given** the 3D editor is open, **When** the user imports a supported model file, **Then** it appears in the scene as one object with its original materials and textures, and is selected.
2. **Given** an imported model is in the scene, **When** the project is saved and reopened (also on another machine), **Then** the model is restored without needing the original file.
3. **Given** the chosen file is invalid or unsupported, **When** the import is attempted, **Then** a clear error message is shown and the scene is unchanged.

---

### User Story 8 - Distribute and align objects (Priority: P3)

A user selects several objects (e.g. eight moving heads) and aligns them on one axis or distributes them evenly between the first and the last selected object.

**Why this priority**: Speeds up typical rig layouts, but can be done manually with snapping.

**Independent Test**: Place 8 fixtures roughly along a line, use "Distribute evenly" and "Align", and confirm equal spacing and identical height.

**Acceptance Scenarios**:

1. **Given** three or more objects are selected, **When** the user chooses "Distribute evenly along X", **Then** the objects keep the outermost positions and are spaced equally in between.
2. **Given** two or more objects are selected, **When** the user chooses "Align Y to active object", **Then** all selected objects get the active object's Y position.

---

### Edge Cases

- A project saved with the old scene format is loaded: the old static scene is discarded, a default scene (floor) is created, and the user is told once that the static scene must be rebuilt. Existing fixture visualizations keep their position and rotation where they can be converted.
- A fixture is deleted in the Fixtures list: its visualization object disappears from the scene, and the deletion can't leave dangling references.
- A fixture's visualization type is changed: the scene object keeps its name, transform and parent.
- An object that has children is deleted: the children are deleted with it (undoable). Deleting a fixture visualization this way does not delete the fixture.
- An object is moved far away or scaled to almost zero: "Focus selection" and the outliner still let the user find it; scale cannot reach zero or negative values.
- A transform drag is in progress when the user presses undo: the drag is cancelled and the object returns to where it was before the drag.
- An imported model is very large (e.g. 50 MB) or has an extreme scale: the user gets a warning about the project file size, and the model is auto-scaled to fit a reasonable size with the option to restore its original scale.
- The show window is closed and reopened, or opened twice: each instance shows the current state.
- The editor and the show window are both open during playback: fixture output in both stays in sync with the timeline.
- Keyboard shortcuts used in the editor (e.g. delete, undo) must not trigger while the user is typing in a text field.

## Requirements *(mandatory)*

### Functional Requirements

**Scene model**

- **FR-001**: Every project MUST contain exactly one scene, saved and loaded as part of the project and included in stage export/import.
- **FR-002**: A new project MUST start with a default scene containing a ground floor and a default camera position.
- **FR-003**: The scene MUST consist of named objects arranged in a parent/child hierarchy. Each object MUST have a unique identifier, a name, a position, a rotation, a scale, a parent (or none), and visible/locked flags.
- **FR-004**: The scene MUST use a single, documented coordinate convention: distances in meters, a vertical "up" axis, and the floor at height 0.
- **FR-005**: Object kinds in this feature MUST be: basic shape (box, cylinder, plane, sphere with dimensions and color), fixture visualization, imported model, and empty group. The object structure MUST allow additional kinds (library assets in feature 2) to be added without changing existing saved objects.
- **FR-006**: Each fixture visualization MUST be represented by exactly one scene object and placed through the same position/rotation/parent mechanism as all other objects. Type-specific placement data (e.g. the LED strip's start and end points) MUST be expressed relative to that object.
- **FR-007**: The previous scene-file import ("Load Scene") MUST be removed. Loading a project saved in the old format MUST NOT fail; the behavior is described under Edge Cases.

**Editor view & navigation**

- **FR-010**: The Visualization tab of the Stage view MUST show the interactive 3D editor embedded in the main window.
- **FR-011**: Users MUST be able to orbit, pan and zoom the camera with the mouse, and switch to top, front, side and perspective views.
- **FR-012**: Users MUST be able to focus the camera on the current selection.
- **FR-013**: The editor MUST show a reference grid and axis orientation indicator, which can be toggled.
- **FR-014**: Fixture visualizations MUST render correctly from any camera position and update while the camera moves.

**Selection & transformation**

- **FR-020**: Users MUST be able to select objects by clicking in the 3D view and in the outliner, add or remove objects from the selection with a modifier key, and clear the selection.
- **FR-021**: Selected objects MUST be visually highlighted in the editor, and the editor MUST be able to show name labels for objects (toggleable).
- **FR-022**: Users MUST be able to move, rotate and scale selected objects with on-screen handles, choosing between world and local axes.
- **FR-023**: Users MUST be able to enable grid snapping (configurable step in meters) and angle snapping (configurable step in degrees), and temporarily toggle snapping with a modifier key while dragging.
- **FR-024**: An inspector MUST show and allow editing of the selected object's name, position, rotation, scale and kind-specific properties; changes MUST apply immediately without an "Apply" step.
- **FR-025**: For fixture visualizations, the inspector MUST also show the visualization's settings (e.g. channel mapping) and a way to open the linked fixture's settings.
- **FR-026**: Selecting a fixture in the Fixtures list MUST select its visualization object in the editor, and vice versa.
- **FR-027**: LED strip visualizations MUST provide draggable handles for their start and end points.

**Creating & organizing**

- **FR-030**: Users MUST be able to add basic shapes and empty groups from an "Add" menu. A newly added object MUST be placed on the surface under the mouse pointer when one is hit, otherwise at the scene origin on the floor.
- **FR-031**: Users MUST be able to create a fixture visualization for a fixture from within the editor (choosing the fixture and visualization type), as well as from the existing fixture settings.
- **FR-032**: An outliner MUST list all objects in their hierarchy and support selecting, renaming, hiding, locking and reparenting by drag and drop.
- **FR-033**: Reparenting MUST keep the object's world position and orientation unchanged at the moment of reparenting.
- **FR-034**: Users MUST be able to duplicate, copy, paste and delete selected objects (including their children). Duplicated or pasted fixture visualizations MUST NOT be linked to a fixture until the user assigns one, because a fixture can have only one visualization.
- **FR-035**: Deleting a fixture visualization object MUST NOT delete the fixture. Deleting a fixture MUST remove its visualization object.
- **FR-036**: Users MUST be able to align selected objects along an axis to the active object, and distribute three or more selected objects evenly along an axis.
- **FR-037**: Users MUST be able to import a 3D model file as a single scene object. The model MUST keep its original materials and textures and MUST be stored inside the project so it loads without the original file. Invalid files MUST produce a clear error and leave the scene unchanged.

**Undo / redo & shortcuts**

- **FR-040**: All scene editing actions (add, delete, transform, property change, rename, reparent, hide/lock, align/distribute, import) MUST be undoable and redoable. A continuous drag MUST count as a single action. Undo history is limited to the current session and to scene editing.
- **FR-041**: The editor MUST provide keyboard shortcuts for at least: move/rotate/scale mode, delete, duplicate, undo, redo, focus selection, and toggling snapping. Shortcuts MUST NOT trigger while a text input has focus.

**Show window**

- **FR-050**: The separate visualization window MUST show the current scene and fixture states without editing aids (grid, handles, highlights, labels) and MUST NOT allow editing.
- **FR-051**: Scene changes made in the editor MUST appear in an open show window within 0.5 seconds.
- **FR-052**: The show window MUST have its own camera navigation (orbit, pan, zoom) independent of the editor camera.
- **FR-053**: Users MUST be able to save named camera positions, apply them in the editor and in the show window, and mark one as the show window's default. Saved camera positions MUST be stored in the project.

**Platform & robustness**

- **FR-060**: All capabilities MUST work in both the desktop and the browser version of the app.
- **FR-061**: An object that cannot be displayed (e.g. corrupted imported model data) MUST be shown as a clearly marked placeholder and MUST NOT prevent the rest of the scene from loading.
- **FR-062**: Opening, closing and reopening the editor or show window, or loading another project, MUST NOT leave previous scenes rendering in the background or degrade performance over time.

### Key Entities

- **Scene**: The single static and fixture layout of a project. Contains the object hierarchy, saved camera positions, and editor settings (snap steps, grid visibility).
- **Scene Object**: Anything placed in the scene. Has identity, name, transform (position, rotation, scale), optional parent, visibility and lock state, and a kind with kind-specific properties.
- **Basic Shape** *(object kind)*: Box, cylinder, plane or sphere with dimensions in meters and a color.
- **Fixture Visualization** *(object kind)*: The 3D representation of one fixture. References the fixture and holds the visualization type and its settings (channel mapping, type-specific geometry such as LED strip endpoints).
- **Imported Model** *(object kind)*: A user-provided 3D model stored in the project, with its original materials.
- **Group** *(object kind)*: An empty object used to organize and move other objects together.
- **Camera Position**: A named viewpoint (position, target, field of view), optionally marked as the show window default.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can place a fixture visualization at a chosen spot on the stage, facing a chosen direction, in under 30 seconds without typing any numbers.
- **SC-002**: Starting from a new project, a user can build a simple stage (floor platform, back wall, table, and 8 fixtures arranged evenly in a row) in under 10 minutes, entirely inside the app.
- **SC-003**: 100% of scene content (objects, hierarchy, properties, imported models, camera positions) is identical after saving and reopening a project, and after stage export and import.
- **SC-004**: The editor stays smooth (no visible stutter while orbiting or dragging) with a scene of 200 objects including 50 fixture visualizations, on the developer's reference machine.
- **SC-005**: Changes made in the editor appear in the show window within 0.5 seconds.
- **SC-006**: Opening and closing the show window or loading a different project 10 times in a row causes no noticeable slowdown.
- **SC-007**: Every editing action in the acceptance scenarios can be undone and redone, returning the scene to the exact prior state.

## Manual Verification *(required by constitution, principle III)*

Run each step in **both** the desktop (Electron) and the browser build.

1. Create a new project and open Stage → Visualization. Expected: a floor and grid are visible; orbit, pan, zoom and the top/front/side views work.
2. Add a box, a cylinder, a plane and a sphere. Resize, recolor, rename and move each one with handles and with the inspector. Turn snapping on and verify the 0.25 m / 15° steps.
3. Create a DMX fixture with a moving head visualization and an LED strip fixture with an LED strip visualization. Place both by mouse; drag the LED strip's start/end handles. Play a timeline item that drives the fixtures. Expected: the moving head pans/tilts and changes color; the LED strip lights nearby surfaces; the beams look correct while orbiting.
4. Create a group "Truss", attach three fixtures to it in the outliner, move and rotate the group. Expected: the fixtures follow. Undo and redo the last 5 actions and verify each step.
5. Duplicate, copy/paste, hide, lock and delete objects; delete a fixture visualization object and confirm the fixture still exists; delete a fixture and confirm its visualization disappears.
6. Select 8 fixtures and use align and distribute. Expected: equal spacing and identical height.
7. Import a textured model file. Expected: textures are preserved. Try an invalid file. Expected: an error message and no change.
8. Save two camera positions. Open the show window: the scene matches the editor with no editing aids; move an object in the editor and confirm the show window updates; switch camera positions in the show window.
9. Save, close and reopen the project; export the stage and import it into a new project. Expected: everything from steps 2–8 is restored.
10. Load a project saved before this feature. Expected: it loads, a default floor is shown, a one-time notice explains that the static scene must be rebuilt, and fixture visualizations keep their placement where convertible.

## Assumptions

- The editor interaction model follows common 3D tools (orbit/pan/zoom with mouse buttons and wheel, move/rotate/scale handles, outliner + inspector). Exact mouse and key bindings are decided during planning.
- Fixture visualization types stay as they are today (LED strip, spot, moving head) with their current look. New types, new models and rendering improvements belong to features 2 and 3. The moving head keeps its current built-in model.
- Parametric stage construction elements (truss, platforms with stairs, curtains) and decoration models belong to feature 2. Until then, basic shapes and imported models cover these needs.
- Freeform LED strip shapes (polylines/curves) and per-pixel LED rendering belong to feature 3. In this feature, LED strips stay straight with a start and end point.
- The supported import format is the common binary single-file 3D model format already used for the built-in moving head model; other formats are out of scope.
- Imported models are embedded in the project file. Project files can therefore grow; this is acceptable before 1.0.
- Project file compatibility may break (constitution principle IV). The commit/PR must state that old static scenes are not migrated.
- Undo/redo covers scene editing only; the rest of the app has no undo today, and adding it is out of scope.
- One fixture has at most one visualization, as today.
- MVR/GDTF import, screenshot/video export and multiple simultaneous show windows with different cameras beyond FR-052 are out of scope.
