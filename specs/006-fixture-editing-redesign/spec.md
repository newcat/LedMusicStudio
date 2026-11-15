# Feature Specification: Fixture Editing Redesign

**Feature Branch**: `main` (no feature branch, see project convention)

**Created**: 2026-11-15

**Status**: Implemented (2026-11-16). Browser build checked during implementation (add/duplicate/delete/undo with controller and group restore, profile auto-mapping, LED count from path, migration incl. re-import, no inspector overflow at 340 px, ranges dialog, Controllers link, Groups "Add selected fixtures"). Open: full manual procedure in the desktop build (`pnpm electron:dev`), migration with a real pre-feature file (T002), DMX output on hardware.

**Input**: User description: "I want to redesign the way that fixture editing works. Currently, there is a lot of duplication between the 'Fixtures' and the 'Visualization' tabs. The visualization tab should be the only way to add/edit/remove fixtures and all fixture properties should be editable in the properties panel for the fixture. We'll still need 'Controllers' and 'Groups' for now. Additionally, the layout looks very cluttered in the visualization tab, especially in the properties panel / channel mapping. The overflow doesn't work well and in general all the margins and paddings look off." Design direction agreed in the preceding analysis: one scene object = one fixture; fixture add/delete/duplicate and fixture edits are undoable; existing projects are migrated on load; the inspector is reorganised into collapsible sections with label|control rows; the channel mapping shows mapped capabilities by default and moves wide tables into a dialog.

## Context

A fixture is currently two things that the user has to manage separately:

- The **fixture** (name, type, DMX profile, mode, start channel, LED count, controller, attribute defaults) is created and edited in the Stage → Fixtures tab.
- Its **visualization object** (position, model, visualization type, beam and movement settings, capability mapping) is created and edited in the Stage → Visualization tab.

They are connected by a link that can be made in three places (the Fixtures tab "Visualization" select, the "Add fixture visualization" dialog and the inspector's "Linked fixture" select). "Draw LED strip" and dropping a fixture model from the asset library create visualization objects without any fixture. The object and the fixture each have a name, and the two names drift apart after creation. Visualization edits can be undone, fixture edits cannot.

The visualization inspector is also hard to use. Measured at the default layout (1600 × 900 window, inspector at 20 % width):

- The inspector is 281 px wide but its content is 506 px wide (640 px with a range table open), so the whole panel scrolls sideways and labels and sliders scroll out of view.
- For a 24-channel moving head the panel is about 5,800 px tall: 29 capability rows, each wrapping over two to four lines.
- Field sizes, gaps and paddings differ between sections; a fieldset adds its own padding inside the padded panel; every label sits above its control.
- The object name is cut off ("DMX Fixt") because the kind chip takes most of the header.
- The editor toolbar wraps to two rows at 1600 px; outliner rows are indented about 70 px; Import/Export Stage look like additional tabs.

## Glossary

- **Fixture**: a light or effect device the show controls. Types: DMX fixture and LED strip.
- **Fixture object**: the object in the 3D scene that represents one fixture. After this feature every fixture has exactly one fixture object and every fixture object has exactly one fixture.
- **DMX profile**: the fixture definition (manufacturer, model, modes, channels) chosen from the Open Fixture Library or loaded from an OFL fixture file.
- **Unpatched DMX fixture**: a DMX fixture without a profile yet. It exists in the scene and can be positioned, but it produces no output and shows a warning.
- **Channel range**: the DMX channels a DMX fixture occupies: from its start channel to start channel + channel count of its mode − 1.
- **Capability mapping**: the assignment of the fixture's DMX channels to the visualization's capabilities (pan, tilt, dimmer, colour, zoom, …), used to render the fixture in the 3D view.
- **Inspector**: the properties panel on the right side of the scene editor.
- **Section**: a collapsible block of related properties in the inspector.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add, duplicate and remove fixtures in the scene (Priority: P1)

A user builds a stage. In the Visualization tab they add a DMX fixture from the toolbar (or drop a moving-head model from the asset library) and a new fixture appears in the scene and in the outliner, selected and ready to configure. They draw an LED strip with the strip tool and get a working LED strip fixture. They duplicate a configured moving head four times and each copy is a complete, independent fixture on the same controller. They delete one and press Ctrl+Z to bring it back. There is no Fixtures tab any more.

**Why this priority**: this is the core of the request: a single place where fixtures are created and removed, without having to keep two lists in sync.

**Independent Test**: starting from an empty stage, add each kind of fixture through every entry point, duplicate, delete, undo and redo, and check that the Controllers and Groups tabs, the timeline target pickers and the DMX output always see exactly the fixtures that exist in the scene.

**Acceptance Scenarios**:

1. **Given** the Visualization tab, **When** the user chooses Add → DMX fixture, **Then** one new DMX fixture and its fixture object are created at the current placement point, the object is selected, and the DMX profile chooser opens.
2. **Given** the profile chooser was opened for a new fixture, **When** the user cancels it, **Then** the fixture stays in the scene as an unpatched DMX fixture with a warning, and the profile can be chosen later from the inspector.
3. **Given** the Visualization tab, **When** the user chooses Add → LED strip or uses "Draw LED strip" and finishes a path, **Then** one new LED strip fixture with a fixture object is created; its LED count starts at 30 per metre of path length (at least 1).
4. **Given** the asset library, **When** the user drops a fixture model into the scene, **Then** an unpatched DMX fixture with that model and the model's visualization type is created at the drop point (for the LED strip profile model: an LED strip fixture).
5. **Given** a configured DMX fixture assigned to a controller, **When** the user duplicates its object (context menu, Ctrl+D or copy & paste), **Then** the copy is a new fixture with the same profile, mode, start channel, attribute defaults, visualization settings, capability mapping and controller, a new identity and a unique name ("Spot 1" → "Spot 2").
6. **Given** a selected fixture object, **When** the user deletes it, **Then** the fixture disappears everywhere (scene, outliner, Controllers tab, Groups, target pickers, output).
7. **Given** a fixture was deleted, **When** the user presses Ctrl+Z, **Then** the fixture comes back with the same identity, configuration, controller assignment and group memberships, so clips that targeted it target it again.
8. **Given** the Stage view, **When** the user looks at the tabs, **Then** only Controllers, Visualization and Groups are offered, and Visualization is the default tab.

---

### User Story 2 - Edit every fixture property in the inspector (Priority: P1)

A user selects a fixture in the scene or outliner and sets everything about it in the inspector: name, DMX profile, mode, start channel, controller, LED count, attribute defaults, model, visualization type and beam settings. While choosing the start channel they see the channel range the fixture will occupy and a warning if it overlaps another fixture on the same controller. Every change can be undone.

**Why this priority**: removing the Fixtures tab is only possible if nothing that was editable there is lost.

**Independent Test**: for one DMX fixture and one LED strip, change every property that was editable in the old Fixtures tab from the inspector only, verify the DMX output and the 3D view follow, then undo every change step by step.

**Acceptance Scenarios**:

1. **Given** a selected DMX fixture, **When** the user opens the Fixture section, **Then** they can choose or change the DMX profile, open the profile's Open Fixture Library page (when it has one), choose the mode, set the start channel and choose the controller.
2. **Given** a DMX fixture with a 24-channel mode, **When** the user sets the start channel to 25, **Then** the inspector shows "25–48".
3. **Given** another fixture on the same controller occupies channels 30–45, **When** the user sets the start channel to 25 on a 24-channel fixture, **Then** a warning names the overlapping fixture; the value is still accepted.
4. **Given** a start channel whose channel range would end above 512, **When** the user enters it, **Then** a warning says the fixture does not fit into the universe; the value is still accepted.
5. **Given** a selected LED strip, **When** the user opens the Fixture section, **Then** they can set the LED count and the controller, and the path, interpolation, closed loop, pixel size and intensity remain editable.
6. **Given** a selected fixture, **When** the user renames it in the inspector header or the outliner, **Then** the same name is shown in the outliner, the Controllers tab, Groups, target pickers and 3D labels.
7. **Given** any fixture property was changed in the inspector, **When** the user presses Ctrl+Z, **Then** the previous value is restored in one step (consecutive edits of the same field, e.g. typing or spinner clicks, form one step).
8. **Given** only controllers of other types exist, **When** the user opens the controller select, **Then** only "None" and compatible controllers are offered.
9. **Given** a fixture with validation problems (no profile, no controller, mode missing), **When** it is selected, **Then** a compact summary lists the problems at the top of the inspector, and clicking a problem opens and scrolls to the section where it can be fixed.

---

### User Story 3 - A tidy, readable inspector (Priority: P2)

A user works on a laptop-sized window. The inspector never scrolls sideways, related properties are grouped in sections they can collapse, labels sit next to their controls, and sizes and spacing are consistent. Collapsing "Transform" once keeps it collapsed for every other fixture they select.

**Why this priority**: the user called out the clutter explicitly; it slows down every fixture edit, but the inspector is usable without it.

**Independent Test**: select a 24-channel moving head, an LED strip, a shape and a library asset at the minimum inspector width and at the default width, and check for horizontal scrolling, consistent spacing and section behaviour.

**Acceptance Scenarios**:

1. **Given** the inspector at its minimum width, **When** any object kind is selected and any section is open, **Then** there is no horizontal scrollbar and no control is cut off.
2. **Given** a selected fixture, **When** the inspector is shown, **Then** the properties are grouped in the sections Transform, Fixture, Appearance, Beam & movement (only for types that have beam settings), Channel mapping (only for DMX fixtures) and Defaults (only for DMX fixtures with a profile), in that order.
3. **Given** the user collapsed a section, **When** they select another object that has the same section, **Then** the section is still collapsed; the open/closed state survives switching tabs and is remembered between sessions.
4. **Given** the inspector header, **When** a fixture is selected, **Then** the name field uses the full width next to a small kind icon, and an overflow menu offers Duplicate, Delete and (when available) Open OFL page.
5. **Given** any property row, **When** it is shown, **Then** the label is on the left and the control on the right, using the same label column width, control height and spacing as every other row in the inspector.
6. **Given** a slider property (edge softness, pixel size, intensity), **When** it is shown, **Then** a number input next to the slider shows the value and accepts typed values.

---

### User Story 4 - Map DMX channels without scrolling through everything (Priority: P2)

A user configures a moving head with 24 channels. The Channel mapping section header shows "18 / 24 channels mapped" and an Auto-Assign button. The list shows only mapped capabilities, each on one compact row with a short summary below, so it fits on a couple of screens. When they need to map a capability Auto-Assign missed, they reveal the unmapped capabilities. Detailed range editing opens in a dialog where the table has room.

**Why this priority**: the channel mapping is the worst offender for overflow and height, but users only need it when Auto-Assign is not good enough.

**Independent Test**: with a 24-channel moving head and a pixel bar, run Auto-Assign, change a channel, add a fine channel, edit ranges and cells in the dialog, and check that the section never overflows horizontally and shows the correct counts.

**Acceptance Scenarios**:

1. **Given** a DMX fixture with a profile, **When** the Channel mapping section is shown, **Then** its header shows the number of mapped channels out of the mode's channel count and an Auto-Assign button.
2. **Given** a mapping, **When** the section is open, **Then** only mapped capabilities are listed, followed by a "Show N unmapped" toggle that reveals the others.
3. **Given** a listed capability, **When** it is shown, **Then** it takes one row (label, channel select filling the remaining width, auto/manual indicator) plus at most one muted summary line (e.g. "16-bit · −265°…265°" or "3 ranges").
4. **Given** a capability with a fine channel option, **When** the user maps it, **Then** the fine channel can be set without the row becoming wider than the inspector.
5. **Given** a capability with ranges, **When** the user chooses "Edit ranges…", **Then** a dialog shows the range table (from, to, kind, values) with room for all columns; changes apply as they are made and are undoable.
6. **Given** a fixture with pixel cells, **When** the user chooses "Edit cells…", **Then** a dialog shows the cell table with one column per colour channel.
7. **Given** manual mappings exist, **When** the user presses Auto-Assign, **Then** they are asked to confirm replacing them (as today).
8. **Given** the fixture's mode changed after the mapping was made, **When** the section is shown, **Then** one compact warning says the mapping may be outdated.
9. **Given** unmapped fixture channels, **When** the section is shown, **Then** they are listed in a muted line (as today), not as error-looking text.

---

### User Story 5 - Existing projects keep working (Priority: P2)

A user opens a project made before this feature. Fixtures that never had a visualization appear in the scene in an "Unplaced fixtures" group at the origin, ready to be moved into place. LED strips and fixture models that were never linked to a fixture now have one. Nothing is lost.

**Why this priority**: without it, old projects would contain fixtures that can no longer be edited at all.

**Independent Test**: load a stage file that contains (a) linked fixtures, (b) a DMX fixture and an LED strip without visualization, (c) an unlinked LED strip and an unlinked moving-head object, and check the result against the scenarios below.

**Acceptance Scenarios**:

1. **Given** a stage file with a fixture that has no fixture object, **When** it is loaded, **Then** a fixture object with the fixture's preselected (or default) visualization type and model is created inside a group named "Unplaced fixtures" at the scene origin.
2. **Given** a stage file with an unlinked LED strip object, **When** it is loaded, **Then** a new LED strip fixture with the object's name and an LED count of 30 per metre of path length is created and linked to it.
3. **Given** a stage file with an unlinked DMX-type fixture object, **When** it is loaded, **Then** a new unpatched DMX fixture with the object's name is created and linked to it.
4. **Given** a fixture object and its fixture with different names, **When** the file is loaded, **Then** the fixture's name is used for both.
5. **Given** the migration ran, **When** the user presses Ctrl+Z right after loading, **Then** nothing from the migration is undone (the loaded state is the start of the history).
6. **Given** a migrated project is saved and loaded again, **When** it loads, **Then** no further changes are made.

---

### User Story 6 - Controllers, Groups and the editor chrome fit the new flow (Priority: P3)

A user assigns fixtures in the Groups tab by selecting them in the scene first, jumps from a controller's fixture list straight to a fixture in the scene, and works with an editor toolbar that fits on one row.

**Why this priority**: polish that makes the remaining tabs and the editor frame consistent with the new flow; nothing is blocked without it.

**Independent Test**: use the Groups and Controllers tabs together with the Visualization tab and check the layout of the toolbar, outliner and tab bar at 1600 × 900.

**Acceptance Scenarios**:

1. **Given** fixtures are selected in the scene, **When** the user opens a group in the Groups tab and chooses "Add selected fixtures", **Then** all selected DMX fixtures that are not yet members are added.
2. **Given** a controller in the Controllers tab, **When** the user clicks one of its controlled fixtures, **Then** the Visualization tab opens with that fixture selected and framed.
3. **Given** a 1600 × 900 window, **When** the Visualization tab is shown, **Then** the editor toolbar fits on one row, with Grid, Axes and Labels toggles inside the Display popover.
4. **Given** the outliner, **When** it is shown, **Then** it has a "Scene" header like the asset library's header, and objects without children are not indented by an empty expand-toggle space.
5. **Given** the Stage view, **When** it is shown, **Then** Import Stage and Export Stage are not placed in the tab bar where they look like tabs (they move to the main menu's Stage entry or a separate area at the right edge).

---

### Edge Cases

- **Deleting a fixture used elsewhere**: the fixture is removed from its groups and from its controller; clips that targeted it target nothing. Undo restores the fixture with the same identity and its memberships, so those references work again. No confirmation is asked (undo is the safety net), except where deletion already asks today (aim targets used by looks/presets).
- **Deleting a group of objects that contains fixtures**: every contained fixture is deleted with it, in one undo step.
- **Duplicating several fixtures at once**: each copy gets its own new fixture; copies keep their controller; names stay unique.
- **Pasting fixture objects copied before a fixture was deleted**: the paste creates new fixtures from the copied configuration.
- **Copy & paste into another project** (after loading a different stage): pasted fixtures are created as new fixtures; a controller that does not exist in that project leaves the copy unassigned.
- **Changing the DMX profile or mode**: the channel range and overlap warning update immediately; the capability mapping is not changed automatically (the outdated warning appears).
- **Changing the LED count**: the visualization and the controller follow immediately (as today), and the change is undoable.
- **Choosing a different model or visualization type**: allowed only among types compatible with the fixture type (LED strip ↔ LED strip types, DMX ↔ DMX types).
- **Undo of fixture creation while the profile chooser is still open**: the chooser closes.
- **Fixture objects created by a newer version** (unknown kind/type): stay editable as far as today (transform only); they do not cause a fixture to be deleted.
- **Very narrow inspector**: property rows switch to label-above-control below the minimum width instead of overflowing.
- **Undo after edits in the Controllers or Groups tab**: those tabs keep their current (non-undoable) behaviour; this feature does not add undo there.
- **Stage import**: importing a stage replaces the scene and fixtures as today, runs the migration on the imported data and clears the undo history.

## Requirements *(mandatory)*

### Functional Requirements

**One object = one fixture**

- **FR-001**: Every fixture MUST have exactly one fixture object in the scene, and every fixture object MUST have exactly one fixture, at all times after loading.
- **FR-002**: The scene editor toolbar's Add menu MUST offer "DMX fixture" and "LED strip". "Draw LED strip" MUST create an LED strip fixture together with its object. Dropping or adding a fixture model from the asset library MUST create a fixture of the matching type together with its object.
- **FR-003**: Adding a DMX fixture from the Add menu MUST open the DMX profile chooser for it; cancelling MUST keep the fixture as an unpatched DMX fixture.
- **FR-004**: Deleting a fixture object MUST delete its fixture, including its controller assignment and group memberships.
- **FR-005**: Duplicating or pasting a fixture object MUST create a new fixture with a copy of the source fixture's configuration and controller assignment, a new identity and a unique name.
- **FR-006**: A fixture and its object MUST have a single name; renaming in the inspector or the outliner MUST rename the fixture everywhere it is shown.
- **FR-007**: The Fixtures tab, the "Add fixture visualization" dialog, the inspector's "Linked fixture" select, the "Open fixture settings" button and the "Open fixture settings" context-menu entry MUST be removed.
- **FR-008**: The Stage view MUST show the tabs Controllers, Visualization and Groups, with Visualization as the default.

**Undo**

- **FR-009**: Adding, deleting, duplicating and pasting fixtures MUST be undoable and redoable through the scene editor's history, restoring the fixture with the same identity, configuration, controller assignment and group memberships.
- **FR-010**: Every fixture property edited in the inspector (name, profile, mode, start channel, LED count, controller, attribute defaults) MUST be undoable and redoable through the same history; consecutive edits of the same field MUST merge into one step as transform edits do today.
- **FR-011**: Loading or importing a stage, including its migration, MUST start a fresh history.

**Inspector content**

- **FR-012**: For DMX fixtures the inspector MUST allow choosing the DMX profile (from the library or an OFL fixture file), opening its OFL page when available, choosing the mode, setting the start channel (1–512) and choosing the controller.
- **FR-013**: The inspector MUST show the channel range of a DMX fixture with a profile and MUST warn, without blocking, when the range overlaps another fixture on the same controller or ends above channel 512.
- **FR-014**: For LED strips the inspector MUST allow setting the LED count (1–10,000) and the controller, in addition to the existing path and appearance settings.
- **FR-015**: The attribute defaults editor (feature 004) MUST be available in the inspector for DMX fixtures with a profile and mode.
- **FR-016**: The model and visualization type selects MUST only offer options compatible with the fixture type.
- **FR-017**: The inspector MUST show a compact summary of the selected fixture's validation problems; each entry MUST open and scroll to the section where it can be fixed.

**Inspector layout**

- **FR-018**: Inspector content MUST be grouped into collapsible sections: Transform, Fixture, Appearance, Beam & movement, Channel mapping, Defaults for fixtures; Transform plus the kind's existing properties for other object kinds. Sections that do not apply to the selected object MUST be hidden.
- **FR-019**: The open/closed state of each section MUST be kept per section name across selections, tab switches and sessions.
- **FR-020**: Property rows MUST place the label to the left of the control with one shared label column; controls MUST fill the remaining width. Below the minimum inspector width rows MUST stack label above control.
- **FR-021**: All inspector controls MUST use one compact size, and spacing MUST come from one scale (4, 8, 12, 16 px) with no extra nested panel padding.
- **FR-022**: The inspector MUST NOT scroll horizontally at its minimum width (about 320 px) for any object kind and any open section.
- **FR-023**: The inspector header MUST show a full-width name field, a kind icon and an overflow menu with Duplicate, Delete and (when available) Open OFL page.
- **FR-024**: Slider properties MUST be paired with a number input showing and accepting the value.

**Channel mapping**

- **FR-025**: The Channel mapping section header MUST show mapped channels / channels of the mode and an Auto-Assign button (with the existing confirmation when manual mappings would be replaced).
- **FR-026**: The mapping list MUST show mapped capabilities by default and offer a "Show N unmapped" toggle for the rest.
- **FR-027**: Each capability entry MUST take one row (label, channel select, auto/manual indicator) and at most one summary line; fine channel, default value and range inputs MUST fit within the inspector width.
- **FR-028**: Editing a capability's ranges and editing pixel cells MUST happen in a dialog that has room for the full table; edits MUST apply immediately and be undoable.
- **FR-029**: The outdated-mapping warning and the unmapped-channels note MUST remain, each shown compactly once.

**Migration**

- **FR-030**: On loading or importing a stage, a fixture without a fixture object MUST get one (preselected or default type and model) inside a group "Unplaced fixtures" at the scene origin.
- **FR-031**: On loading or importing a stage, an unlinked LED strip object MUST get a new LED strip fixture (30 LEDs per metre of path, at least 1) and an unlinked DMX-type fixture object MUST get a new unpatched DMX fixture; both take the object's name.
- **FR-032**: On load, when a fixture and its object have different names, the fixture's name MUST be used for both.
- **FR-033**: Loading a project that needs no migration MUST change nothing.

**Controllers, Groups and editor chrome**

- **FR-034**: The Groups tab MUST offer "Add selected fixtures" for the open group, adding the DMX fixtures currently selected in the scene.
- **FR-035**: Clicking a controlled fixture in the Controllers tab MUST switch to the Visualization tab, select the fixture and frame it.
- **FR-036**: The scene editor toolbar MUST fit on one row at a 1600 px wide window; the Grid, Axes and Labels toggles MUST move into the Display popover.
- **FR-037**: The outliner MUST have a header in the style of the asset library header, and objects without children MUST NOT be indented by an empty expand-toggle space.
- **FR-038**: Import Stage and Export Stage MUST NOT be placed inside the Stage tab bar.
- **FR-039**: Everything in this feature MUST work in the desktop and the browser build (constitution principle I).

### Key Entities

- **Fixture**: identity, name, type (DMX or LED strip), configuration (DMX: profile, mode, start channel, attribute defaults; LED strip: LED count), controller assignment. Owned by the stage; created, changed and deleted only through the scene editor.
- **Fixture object**: the scene object of a fixture: transform, parent, visibility, lock, visualization type, model and size, visualization settings, capability mapping. Exactly one per fixture.
- **Controller**: an output device (DMX, WLED, Razer Chroma) with its list of controlled fixtures. Unchanged, still edited in the Controllers tab.
- **Group**: an ordered set of DMX fixtures used as a programming target. Unchanged, still edited in the Groups tab.
- **History step**: one undoable change; can now include fixtures created, deleted or changed together with scene objects.
- **Inspector section state**: per section name, open or closed; persisted per user.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can add a DMX fixture, choose its profile and mode, set its start channel, assign a controller and place it in the scene without leaving the Visualization tab, in under 1 minute.
- **SC-002**: There is exactly one way to reach each fixture property (the inspector); zero fixture properties are editable only outside the Visualization tab.
- **SC-003**: At the minimum inspector width (about 320 px), no object kind and no open section produces a horizontal scrollbar.
- **SC-004**: For a 24-channel moving head with Auto-Assign applied and all sections open, the inspector content is at most 2,000 px tall (from about 5,800 px today).
- **SC-005**: 100 % of fixture add, delete, duplicate, paste and property edits can be undone and redone, with the fixture's targets in clips, groups and controllers restored.
- **SC-006**: Loading a project made before this feature loses no fixture: every fixture of the file can be selected and edited in the scene after loading.
- **SC-007**: The scene editor toolbar shows on one row at 1600 × 900.

## Manual Verification

Run in the desktop build and in the browser build (`pnpm dev`), 1600 × 900 window unless stated otherwise.

1. **Add**: on an empty stage, Add → DMX fixture; choose "Robe ColorSpot 2500E AT", 24-channel mode. Expect a selected fixture in the scene and outliner, Controllers/Groups tabs see it. Add → LED strip; Draw LED strip (4 m path → 120 LEDs); drop "Par can" from the asset library (unpatched, warning shown).
2. **Patch**: create a DMX controller, assign both DMX fixtures, set start channels 1 and 20. Expect "1–24", "20–…" and an overlap warning naming the other fixture. Send output to real hardware or the DMX panel and check the channels.
3. **Duplicate & delete**: Ctrl+D the moving head; expect "… 2" on the same controller with the same mapping. Add both to a group, target the group and the copy with clips. Delete the copy, check group and clip; Ctrl+Z, check that membership and clip target are back; Ctrl+Y.
4. **Undo of properties**: change name, mode, start channel, LED count, controller, a default; undo each step, redo each step.
5. **Inspector layout**: drag the inspector to its minimum width; select the moving head, the LED strip, a box and a truss; open all sections; expect no horizontal scrollbar. Collapse Transform, select another object, reload the app; Transform stays collapsed.
6. **Channel mapping**: with the moving head, check "x / 24 mapped", only mapped rows, "Show N unmapped"; edit pan ranges in the dialog, undo; with a pixel bar profile, edit cells in the dialog.
7. **Migration**: load a stage file saved before this feature containing a DMX fixture without visualization, an unlinked LED strip and an unlinked moving-head object. Expect the "Unplaced fixtures" group and new fixtures as in User Story 5; Ctrl+Z changes nothing; save, reload, nothing changes.
8. **Chrome**: toolbar on one row; Grid/Axes/Labels in Display; outliner header, no leaf indent; Import/Export not in the tab bar; Groups "Add selected fixtures"; clicking a controlled fixture in Controllers selects and frames it.

## Assumptions

- Fixture types stay DMX and LED strip; Razer Chroma remains a controller-only device without fixtures.
- The Controllers and Groups tabs keep their current editing model and stay non-undoable; only fixture changes join the scene history.
- Constitution principle IV allows breaking file formats, but the user asked for a load-time migration, so old projects are migrated; the file format may still change (the commit must say so if old files stop loading).
- "Unpatched DMX fixture" reuses the existing validation warning ("Please select a fixture"); no new output behaviour is needed (it simply sends nothing).
- Overlap and universe warnings consider only fixtures on the same controller; universes beyond one per controller are out of scope.
- The DMX profile chooser dialog itself (manufacturer/fixture lists, library update, OFL file import) is reused; restyling it is out of scope.
- Section open/closed state is stored per user locally (like other view preferences), not in the project file.
- The asset library panel, viewport, camera, environment and lighting features are unchanged apart from the toolbar and outliner items listed.
- PrimeVue 4.3.4 stays the UI library; no new runtime dependency is needed.
