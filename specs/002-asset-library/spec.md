# Feature Specification: Asset Library & Model Contract

**Feature Branch**: `main` (no feature branch, see project convention)

**Created**: 2026-11-07

**Status**: Implemented

**Input**: User description: "A wide variety of robust models. One or a few per type is enough (e.g. spot, moving head, laser, flamethrower, ...; but also decoration for stages like speakers, instruments, tables, and models to build the stage itself like floor, ...)." Feature 2 of 3, building on the scene model & editor (feature 001).

## Context

Today there is a single 3D model in the app (a moving head). It is hard-wired to the moving head visualization by the internal names of its parts and by fixed size offsets, so it cannot be swapped for another model without code changes. Spots have no body at all, and nothing exists for stage construction or decoration.

Feature 001 introduces an editable scene with basic shapes and single imported models. This feature adds a built-in **asset library**: a browsable collection of fixture models, stage construction elements and decoration that users drag into the scene. It also defines a **model contract**: a description that accompanies every fixture model and states where its moving parts, beam origin and light-emitting surfaces are, so that any conforming model works with the fixture visualizations without code changes.

Related features:

1. Scene model & editor (001, prerequisite)
2. **Asset library & model contract** (this spec)
3. Rendering & fixture capability upgrades (003): dimmer, strobe, zoom, haze, lasers, flames, LED pixel rendering, ...

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse the library and place assets (Priority: P1)

A user opens the asset library panel in the scene editor. Assets are grouped by category (Fixtures, Stage, Decoration, Basic shapes) and show a preview image and a name. The user searches for "speaker", drags a speaker stack onto the stage floor, and it lands on the surface under the mouse pointer, upright and at a realistic size.

**Why this priority**: The library is the entry point for everything else in this feature. Even with only decoration and stage assets it lets users build convincing stages.

**Independent Test**: Open the library, find assets by browsing and by searching, drag five different assets into the scene, and confirm they are placed on surfaces at realistic sizes; save and reopen the project.

**Acceptance Scenarios**:

1. **Given** the scene editor is open, **When** the user opens the asset library, **Then** all assets are shown grouped by category with a preview image and name.
2. **Given** the library is open, **When** the user types into the search field, **Then** only assets whose name, category or keywords match are shown.
3. **Given** the user drags an asset into the 3D view, **When** they release it over a surface, **Then** the asset is placed standing on that surface (its bottom touching it) and is selected.
4. **Given** an asset is placed, **Then** its size corresponds to the real-world object (e.g. a table is about 0.75 m high, a speaker stack about 1.8 m).
5. **Given** a scene with library assets is saved, **When** it is reopened, **Then** all assets are restored, and the project file does not contain copies of the built-in models.

---

### User Story 2 - Generic fixture models that work with the visualizations (Priority: P1)

A user adds a fixture visualization and picks a fitting model from the library: for example "Moving head (spot)", "Moving head (wash)", "Par can" or "LED bar". The model's moving parts follow pan and tilt, and the beam starts exactly at the model's lens, no matter which model is chosen. When the user adds a fixture from the open fixture library, a matching model is suggested automatically based on the fixture's category.

**Why this priority**: Fixture models are the core of the visualization and the main reason for this feature. The model contract is what makes the library robust.

**Independent Test**: Assign three different moving head models in turn to the same moving head fixture, play a pan/tilt sequence, and confirm that each model moves correctly and the beam always starts at its lens.

**Acceptance Scenarios**:

1. **Given** a fixture visualization of type moving head, **When** the user opens its model selector, **Then** only models compatible with moving heads are offered.
2. **Given** a moving head model is chosen, **When** pan and tilt values change, **Then** the model's yoke rotates for pan and its head rotates for tilt around the correct axes, and the beam starts at the lens and points where the head points.
3. **Given** the user switches the model of an existing visualization, **Then** position, rotation, parent, channel mapping and settings stay unchanged; only the body changes.
4. **Given** a DMX fixture whose definition has the category "Moving Head" (or "Color Changer", "Strobe", "Laser", "Smoke", "Pixel Bar", ...), **When** the user creates its visualization, **Then** the matching visualization type and a matching model are preselected.
5. **Given** the fixture definition contains physical dimensions, **When** the visualization is created, **Then** the model is scaled to roughly match those dimensions (the user can reset to the model's default size).
6. **Given** a spot visualization, **Then** it now has a visible fixture body (e.g. a par can) instead of a bare light cone.

---

### User Story 3 - Models for every common fixture category (Priority: P1)

The library contains at least one generic model for every common stage fixture category. For categories that have no dedicated visual effect yet (lasers, flames, smoke, ...), the fixture visualization shows the body and a glowing emitter that follows the fixture's intensity and color, so the user can already see that the fixture is active.

**Why this priority**: The user explicitly wants a wide variety of fixture types. A glowing emitter gives every category a useful visualization before the detailed effects arrive in feature 003.

**Independent Test**: Create one fixture of each category listed in FR-020, place them, map their intensity/color channels, and confirm each shows its model and a glowing emitter that follows the channel values.

**Acceptance Scenarios**:

1. **Given** the library, **Then** it contains a model for each fixture category listed in FR-020.
2. **Given** a laser, flame, smoke or other fixture without a dedicated effect, **When** its mapped intensity channel rises from 0 to full, **Then** its emitter surface glows from off to full brightness in the mapped color (white if no color is mapped).
3. **Given** a multi-emitter model (e.g. LED bar or blinder with several cells), **Then** all of its emitter cells are identified individually in the model description, so feature 003 can drive them separately; in this feature they glow together.

---

### User Story 4 - Parametric stage construction (Priority: P2)

A user builds the stage itself from parametric elements: a stage platform or riser (width, depth, height), stairs that fit a riser height, truss segments (straight with a length, corner, tower), a backdrop or curtain (width, height), walls and floor areas. Changing a dimension rebuilds the element correctly instead of stretching it: a longer truss gets more segments, stairs get more steps.

**Why this priority**: Stage construction is needed in nearly every scene, and parametric elements cover countless sizes with one asset each. Basic shapes from feature 001 are a workable stopgap.

**Independent Test**: Build a 6 m × 4 m × 1 m stage with stairs, a 6 m truss line with two towers and a backdrop, then change the stage height and truss length and confirm the elements adapt without distortion.

**Acceptance Scenarios**:

1. **Given** a platform element is selected, **When** the user changes width, depth or height in the inspector, **Then** the platform is rebuilt with the new dimensions and its edges and legs are not distorted.
2. **Given** a straight truss element, **When** its length changes from 2 m to 5 m, **Then** the truss shows the lattice pattern repeated along the full length rather than stretched.
3. **Given** a stairs element, **When** its total height changes, **Then** the number of steps adjusts so each step keeps a realistic height.
4. **Given** a parametric element is saved, **When** the project is reopened, **Then** it is rebuilt with identical parameters.

---

### User Story 5 - Mount fixtures and connect truss with snapping (Priority: P2)

Assets have connection or mounting points. While dragging a fixture near a truss, it snaps to the truss tube, hanging below or standing on top, and becomes attached to the truss. While dragging a truss segment near another, it snaps end-to-end.

**Why this priority**: Makes realistic rigs fast to build. Without it, users can still place and attach fixtures manually (feature 001).

**Independent Test**: Hang four moving heads under a truss and connect three truss segments plus a corner, using only drag & drop, then move the truss and confirm the fixtures follow.

**Acceptance Scenarios**:

1. **Given** a truss is in the scene, **When** the user drags a fixture near the truss's bottom chord, **Then** the fixture snaps to hang upside down on the truss and is attached to it as a child.
2. **Given** a truss segment is dragged near the free end of another, **When** released within snapping range, **Then** the two segments connect end-to-end and line up exactly.
3. **Given** snapping is temporarily disabled with the modifier key, **Then** the asset is placed freely as in feature 001.

---

### User Story 6 - Decoration assets (Priority: P2)

The library contains decoration that makes a scene recognizable as a stage or club: speaker stacks, line arrays, stage monitors, a DJ booth and DJ table, a drum kit, guitar/bass amplifiers, a keyboard on a stand, a microphone stand, simple furniture and human silhouettes or simple figures for scale.

**Why this priority**: Decoration matters for a convincing preview but not for programming the show.

**Independent Test**: Build a band stage and a DJ setup using only library decoration and confirm every listed decoration type is available.

**Acceptance Scenarios**:

1. **Given** the library, **Then** every decoration type listed in FR-030 is available.
2. **Given** a decoration asset is placed, **When** the user changes its color variant (where offered), **Then** the asset's appearance changes accordingly.

---

### User Story 7 - Materials and colors for stage elements (Priority: P3)

A user assigns materials from a small preset list (e.g. black stage floor, wood, brushed metal, black fabric, white fabric, concrete, glossy plastic) to basic shapes and parametric stage elements, and can still pick an arbitrary color.

**Why this priority**: Improves realism of how light falls on the stage, but plain colors work.

**Independent Test**: Apply each material preset to a box under a moving head beam and confirm each looks distinct (reflective metal vs. matte fabric).

**Acceptance Scenarios**:

1. **Given** a basic shape or parametric element is selected, **When** the user picks a material preset, **Then** its surface appearance changes and responds differently to light (matte vs. shiny).

---

### User Story 8 - See where assets come from (Priority: P3)

A user opens an "Asset credits" view that lists every built-in asset with its author, source and license.

**Why this priority**: Required for correct attribution of third-party models. Low user impact but mandatory before shipping third-party assets.

**Independent Test**: Open the credits view and confirm every asset in the library has author, source and license.

**Acceptance Scenarios**:

1. **Given** the credits view is opened, **Then** every built-in asset is listed with author, source and license, and assets created for this project are marked as such.

---

### Edge Cases

- A project references a built-in asset that no longer exists in a newer app version: a clearly marked placeholder of the same size is shown, the object keeps its transform and parent, and the user can replace the asset.
- A built-in asset is improved in a newer app version: existing scenes show the updated model without breaking position, size or attachments.
- A fixture model's description is incomplete or inconsistent (e.g. no beam origin): the model is not offered for fixture visualizations; it fails a check when it is added to the library, not at runtime.
- A fixture category has no matching model or the fixture has no category: a generic fallback model ("generic fixture") and visualization type are suggested.
- A fixture definition gives unrealistic physical dimensions (e.g. 0 or 10 m): automatic scaling is skipped and the model's default size is used.
- A fixture is snapped to a truss that is later deleted: the fixture is deleted with it (undoable, as in feature 001), and the fixture itself is not deleted.
- A parametric element receives an extreme value (e.g. 0 m length, 200 m truss): values are limited to sensible ranges stated in the inspector.
- Many copies of the same asset (e.g. 100 seats or 40 moving heads) are placed: the scene stays smooth (see SC-004).

## Requirements *(mandatory)*

### Functional Requirements

**Library & browsing**

- **FR-001**: The app MUST include a built-in asset library that ships with the app and works offline in both the desktop and browser versions.
- **FR-002**: The scene editor MUST provide an asset library panel that groups assets by category (Fixtures, Stage, Decoration, Basic shapes), shows a preview image and name for each asset, and supports searching by name, category and keywords.
- **FR-003**: Users MUST be able to drag an asset from the library into the 3D view; it MUST be placed with its bottom on the surface under the mouse pointer (or on the floor at the origin if none is hit), upright, and selected.
- **FR-004**: Every asset MUST have a realistic real-world default size in meters and a defined base point (the point that rests on a surface).
- **FR-005**: Scenes MUST reference built-in assets by a stable identifier rather than embedding them; project files MUST NOT contain copies of built-in models.
- **FR-006**: The basic shapes from feature 001 MUST appear in the library under "Basic shapes".

**Model contract**

- **FR-010**: Every fixture model MUST come with a description stating: the fixture categories it suits, its moving parts and their rotation axes and limits (e.g. pan on the yoke, tilt on the head), the beam origin and direction, the lens size, its emitter surfaces (one or several, individually identifiable), and its mounting points.
- **FR-011**: Fixture visualizations MUST obtain all geometry-dependent information (moving parts, beam origin, lens size, emitters) from the model description, so that any model with a valid description works without code changes.
- **FR-012**: Every asset added to the library MUST be validated against the contract (required parts present, sensible size, preview image, credits). Assets that fail validation MUST NOT be shipped.
- **FR-013**: Users MUST be able to choose the model of a fixture visualization from the models compatible with its visualization type, and switch it later without losing transform, parent, channel mapping or settings.
- **FR-014**: When a visualization is created for a DMX fixture, the visualization type and model MUST be preselected based on the fixture definition's category, falling back to a generic fixture model.
- **FR-015**: When the fixture definition contains plausible physical dimensions, the model MUST be scaled to approximately match them; users MUST be able to reset to the model's default size.

**Fixture models**

- **FR-020**: The library MUST contain at least one fixture model for each of: par can / spot, wash, profile/ellipsoidal spot, moving head (spot/beam style), moving head (wash style), scanner, strobe, blinder, LED bar / batten, pixel bar, laser, flame projector, CO2 jet, cold spark machine, hazer/fog machine, LED panel, and a generic fallback fixture.
- **FR-021**: The existing moving head, spot and LED strip visualizations MUST use library models; the spot MUST show a visible body.
- **FR-022**: Fixture categories without a dedicated effect in this feature (laser, flame, CO2, cold spark, hazer/fog, strobe, blinder, generic) MUST have a basic visualization that shows the model and makes its emitter surfaces glow according to mapped intensity and color channels (white when no color is mapped, full when no intensity is mapped).
- **FR-023**: Multi-cell fixture models (LED bar, pixel bar, blinder, LED panel) MUST describe each cell as a separate emitter; in this feature all cells MAY follow the same value.

**Stage construction & decoration**

- **FR-030**: The library MUST contain at least these decoration assets: speaker stack, line array, stage monitor (wedge), DJ booth, DJ table, drum kit, guitar/bass amplifier, keyboard on stand, microphone stand, table, chair, bar counter, and human figure for scale (at least standing and with raised arms).
- **FR-031**: The library MUST contain these parametric stage elements: platform/riser (width, depth, height), stairs (width, total height), straight truss (length; flat, triangle and square profiles), truss corner, truss tower (height) with base plate, backdrop/curtain (width, height), wall (width, height, thickness) and floor area (width, depth).
- **FR-032**: Changing a parametric element's dimensions MUST rebuild the element without distortion: repeating structures (truss lattice, stair steps, curtain folds) MUST repeat rather than stretch. Each parameter MUST have a documented valid range enforced by the inspector.
- **FR-033**: Decoration assets MAY offer a small set of color variants selectable in the inspector.

**Mounting & snapping**

- **FR-040**: Assets MUST be able to declare connection points (e.g. truss segment ends) and mounting areas (e.g. truss chords, the top of a platform).
- **FR-041**: While dragging, a fixture MUST snap to a nearby mounting area, orient itself appropriately (hanging below or standing on top) and become attached to that asset as a child.
- **FR-042**: While dragging, a truss element MUST snap end-to-end to a nearby free connection point of another truss element.
- **FR-043**: Holding the snapping modifier key (feature 001) MUST disable mounting and connection snapping.

**Materials**

- **FR-050**: Basic shapes and parametric stage elements MUST offer a set of material presets (at least black stage floor, wood, brushed metal, black fabric, white fabric, concrete, glossy plastic) in addition to a free color choice.

**Licensing & credits**

- **FR-060**: Every built-in asset MUST record its author, source and license. Only assets whose license allows redistribution as part of a GPL-3.0 application MAY be included.
- **FR-061**: The app MUST provide an "Asset credits" view listing every built-in asset with author, source and license.

**Robustness**

- **FR-070**: A scene object that references an unknown asset MUST be shown as a clearly marked placeholder with the stored size, keep its transform and parent, and be replaceable by another asset.
- **FR-071**: All library assets MUST be designed for real-time use, so that a scene in the size of SC-004 stays smooth.

### Key Entities

- **Asset**: A built-in library item. Has a stable identifier, name, category, keywords, preview image, default size, base point, credits (author, source, license), and either a model or a parametric generator.
- **Fixture Model Description**: The contract data attached to a fixture asset: compatible fixture categories, moving parts with axes and limits, beam origin and direction, lens size, emitters, mounting points.
- **Emitter**: A light-emitting surface of a fixture model (lens, LED cell, laser aperture, flame nozzle). Identified individually, so later features can drive cells separately.
- **Parametric Element**: An asset generated from parameters (e.g. truss length), each with a valid range, rebuilt when parameters change.
- **Connection Point / Mounting Area**: Places on an asset where other assets connect (truss ends) or can be mounted (truss chords, platform tops).
- **Material Preset**: A named surface appearance (color, shininess, roughness) applicable to shapes and stage elements.
- **Library Asset Object** *(scene object kind, extends feature 001)*: A scene object referencing an asset by identifier, with parameters, material and color variant.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The library covers 100% of the fixture categories (FR-020), decoration types (FR-030) and stage elements (FR-031) listed in this spec.
- **SC-002**: A user finds and places any listed asset in under 15 seconds using browsing or search.
- **SC-003**: A user builds a typical club stage (platform with stairs, truss with two towers, 8 hanging moving heads, 4 pars, DJ booth, 2 speaker stacks, backdrop) in under 10 minutes.
- **SC-004**: A scene with 300 objects, including 60 fixture visualizations and 100 copies of one decoration asset, stays smooth while orbiting and during playback on the developer's reference machine.
- **SC-005**: Replacing the model of a fixture visualization with any other compatible model requires zero manual adjustments for the beam to start at the lens and follow pan/tilt correctly.
- **SC-006**: Adding a new fixture model to the library requires no changes to the visualization logic, only the model and its description.
- **SC-007**: The app's download size grows by no more than 25 MB because of the library.
- **SC-008**: 100% of built-in assets appear in the credits view with author, source and license.

## Manual Verification *(required by constitution, principle III)*

Run each step in **both** the desktop (Electron) and the browser build.

1. Open the asset library. Expected: categories with previews; searching for "truss", "speaker" and "laser" filters correctly.
2. Drag one asset of each category into the scene. Expected: each lands on the surface under the pointer at a realistic size.
3. Create a DMX moving head fixture from the open fixture library and add its visualization. Expected: moving head type and model preselected, roughly scaled to the definition's dimensions. Play pan/tilt and color. Switch through all moving head models; expected: correct movement and beam origin for each, settings preserved.
4. Create one fixture per category of FR-020 and map intensity/color. Expected: each shows its model; categories without a dedicated effect glow at their emitters following the channel values.
5. Build a platform with stairs, a truss line with corner and towers, and a backdrop. Change the dimensions. Expected: no distortion; truss lattice and stairs repeat.
6. Hang moving heads on the truss and connect truss segments by dragging. Expected: snapping and attachment work, and holding the modifier key disables them.
7. Apply each material preset to a box under a beam. Expected: visibly different surfaces.
8. Open the asset credits view. Expected: complete entries for all assets.
9. Save, reopen, export and import the stage. Expected: identical scene, and the project file does not contain built-in model data.
10. Manually edit a saved project so an object references a non-existent asset id and load it. Expected: placeholder shown, rest of the scene loads.

## Assumptions

- Generic models are sufficient: the goal is one or a few recognizable models per type, not replicas of specific products.
- Sources considered for models (licenses verified per asset during planning): QLC+ fixture and truss meshes (Apache-2.0), BlenderDMX generic fixture parts (GPL-3.0), CC0 collections (e.g. Kenney, Quaternius, Poly Haven), and models created for this project. Assets with unclear redistribution terms (e.g. manufacturer models from GDTF Share) are excluded.
- Missing models (e.g. flame projector, CO2 jet, cold spark machine) are created for this project as simple low-poly models.
- Preview images are pre-rendered and shipped with the library.
- Detailed visual effects per fixture category (beam zoom, gobo, strobe, laser beams, flames, smoke, per-cell LED control, LED strip pixel rendering) belong to feature 003; this feature only provides bodies, emitters and the basic glow.
- Importing user-made fixture models with their own contract description, user-defined library assets reusable across projects, and GDTF/MVR import are out of scope.
- Project file compatibility may break (constitution principle IV); commit messages must say so if it does.
