# Feature Specification: Attribute-Based DMX Fixture Programming

**Feature Branch**: `main` (no feature branch, see project convention)

**Created**: 2026-11-14

**Status**: Implemented (manual verification in both targets pending)

**Input**: User description: "Attribute-based DMX fixture programming (feature 004). Make programming classic DMX fixtures (moving heads, spots, washes) practical in this timeline-based app, instead of raw 0-255 per-channel graph nodes, while keeping LED strip workflows unchanged." Full design decisions were agreed in the preceding brainstorm and are reflected below.

## Context

The graph-based approach works well for LED strips, where colors per pixel are the natural unit. Classic DMX fixtures are hard to program today:

- The DMX output node exposes raw 0–255 channel values. The user must know which channel is "tilt fine" and which value range of the color wheel means "red".
- One output node controls one fixture. An effect over eight moving heads must be built eight times with hand-made offsets.
- A graph replaces the complete value set of a fixture (last writer wins per fixture). Clips cannot be layered, e.g. one clip controlling position and another controlling color.
- There is no timing between states (fades, crossfades).

Professional lighting software solves this with the same core ideas: the fixture profile turns channels into **attributes**, users work on **groups**, effects are templates applied to a group with a **phase spread**, **presets** are referenced instead of copied, and an engine **merges** all sources per attribute before converting back to DMX. This feature brings these ideas into the app's timeline model.

The app is a programming tool for pre-produced, music-synchronized shows, not a live console. Live-only features (grand master, blackout, console-style cue tracking, move-in-black) are intentionally excluded.

Builds on feature 003 (rendering capabilities), whose capability mapping already translates fixture definitions into semantic capabilities for the visualization. This feature uses the same mapping in the opposite direction, so programming and visualization always agree.

## Glossary

- **Attribute**: a semantic, fixture-independent control such as dimmer, pan, tilt, color, gobo or zoom, expressed in natural units (0–1, degrees, RGB, named wheel slot) instead of DMX values.
- **Priority**: the order in which timeline tracks win. As today, the lowest track has the highest priority.
- **Release**: when a clip ends, the attributes it controlled return to what lower-priority clips set, or to defaults. Nothing "sticks" after a clip ends.
- **Group**: a named, ordered set of fixtures.
- **Phase spread**: how an effect's cycle is offset across the fixtures of a group (e.g. 360° spread over 8 fixtures = each fixture is 45° later than the previous one).
- **Wings / blocks / interleave**: ways to shape a spread. Wings mirror the order (e.g. 2 wings: outside fixtures move together toward the center). Blocks make N neighbouring fixtures share one phase. Interleave makes every Nth fixture share one phase.
- **Fan**: spreading a value or a timing across a group's order (e.g. pan from −30° to +30° from first to last fixture).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Program a moving head by attributes (Priority: P1)

A user wants a moving head to point at a specific angle, show red and open its gobo, without knowing the fixture's channel layout. In a graph, they add an attribute output node, select the fixture and set "pan 30°, tilt 45°, color red, dimmer 100%". The app converts this into the correct DMX values for that particular fixture model and mode, including 16-bit pan/tilt, color mixing or the closest color wheel slot, and the 3D preview and connected hardware show the expected result.

**Why this priority**: This is the foundation for everything else. On its own it already removes the biggest pain (raw channel values) and makes graphs reusable across fixture models.

**Independent Test**: Patch two different moving head models (one with RGB mixing, one with a color wheel). Drive both from a graph with the same attribute values. Both show red, point in the same direction relative to their mounting and have the same brightness.

**Acceptance Scenarios**:

1. **Given** a moving head with RGB color mixing, **When** the user sets color to red via attributes, **Then** the fixture's red channel is full and green/blue are off.
2. **Given** a moving head with only a color wheel, **When** the user sets color to orange-red, **Then** the wheel moves to the slot that is perceptually closest (e.g. red), not to a split position.
3. **Given** a fixture with 540° pan and 16-bit pan channels, **When** the user sets pan to 90°, **Then** coarse and fine channels encode exactly 90° from the center of the pan range.
4. **Given** a fixture whose definition gives no pan/tilt range, **When** the user opens the attribute controls, **Then** pan and tilt are offered as a 0–1 range instead of degrees, with a hint why.
5. **Given** a fixture with a gobo wheel, **When** the user picks a gobo, **Then** the selection is offered by the slot names from the fixture definition.
6. **Given** a fixture channel that the capability mapping does not cover, **When** attributes are used, **Then** that channel stays at its default value and remains reachable through the raw DMX output node.

---

### User Story 2 - Layer clips per attribute (Priority: P1)

A user places a graph clip that moves eight heads on a lower track, and a clip that only changes their color on a higher-priority track. Both are visible at the same time: the heads keep moving while their color changes. When the color clip ends, color returns to what the lower clip sets, or to the default if nothing sets it.

**Why this priority**: Without per-attribute merging, the new attribute sources cannot be combined, and every clip would have to set every attribute. This changes the core playback behavior and is needed by all later stories.

**Independent Test**: Put a position-only clip and a color-only clip for the same fixture on two tracks with overlapping time ranges. During the overlap, both position and color come from their respective clips. Before and after the color clip, color is at its default.

**Acceptance Scenarios**:

1. **Given** two overlapping clips that set the same attribute, **When** playing the overlap, **Then** the clip on the higher-priority track (lower track) wins for that attribute.
2. **Given** two overlapping clips that set different attributes of the same fixture, **When** playing the overlap, **Then** both attributes are applied.
3. **Given** a clip that has ended, **When** playing past its end, **Then** its attributes are released to lower-priority clips or defaults.
4. **Given** any position on the timeline, **When** the user jumps there or scrubs, **Then** the output is identical to the output during normal playback at that position (no history dependence).
5. **Given** no clip controls a fixture's attribute, **When** playing, **Then** the attribute is at its default (dimmer 0, shutter open, pan/tilt centered, color white/open, gobo open, zoom middle) or at the user's per-fixture override.
6. **Given** an existing project using the raw DMX output node, **When** it is played, **Then** it produces the same output as before, and a raw channel from a higher-priority clip overrides the channels produced by attributes from lower-priority clips (and vice versa).
7. **Given** existing LED strip graphs, **When** they are played, **Then** their output is unchanged.

---

### User Story 3 - Groups with spatial ordering (Priority: P2)

A user creates the group "Truss heads" from six moving heads. Instead of ordering them by hand, they choose "left to right", and the order follows their positions in the 3D scene. They then give a timeline track the default target "Truss heads", so new clips on that track target the group automatically.

**Why this priority**: Groups are the prerequisite for per-fixture graphs, effect clips and looks. Spatial ordering makes spreads look correct without manual work.

**Independent Test**: Create a group, switch its ordering between manual, left-to-right and distance-from-center, and check the shown fixture order against the 3D scene. Set it as track default target, create a new clip on the track and confirm it targets the group.

**Acceptance Scenarios**:

1. **Given** fixtures placed in the 3D scene, **When** the user selects an automatic ordering (left-to-right, right-to-left, front-to-back, back-to-front, bottom-to-top, top-to-bottom, distance from center), **Then** the group's order follows the fixture positions.
2. **Given** an automatically ordered group, **When** a fixture is moved in the scene, **Then** the group order updates.
3. **Given** a group with manual ordering, **When** the user drags fixtures in the list, **Then** the new order is saved.
4. **Given** a track with a default target group, **When** the user creates a new clip on that track, **Then** the clip targets that group; the user can still change the clip's target.
5. **Given** a group that is used by clips, **When** the user deletes a fixture from the stage, **Then** it is removed from the group and the clips keep working with the remaining fixtures.

---

### User Story 4 - One graph drives a whole group (Priority: P2)

A user builds a graph once and applies it to the group "Truss heads". The graph is evaluated separately for every fixture of the group and receives each fixture's index, normalized index (0–1), 3D position and the group size as inputs. With a single sine node fed by the normalized index, the heads form a wave.

**Why this priority**: This removes the duplication of graphs per fixture and makes graphs fixture-independent and reusable, while keeping the full flexibility of the node editor for advanced effects.

**Independent Test**: Build a graph whose tilt output is a sine of time plus normalized index. Apply it to a group of eight heads. The heads show a wave; adding a ninth head to the group extends the wave without changing the graph.

**Acceptance Scenarios**:

1. **Given** a graph with a group attribute output targeting a group of N fixtures, **When** played, **Then** the graph is evaluated N times, once per fixture, with that fixture's index, normalized index, position and group size.
2. **Given** a group output that connects only some attributes (e.g. tilt), **When** played, **Then** only those attributes are set and all others are left to lower-priority clips or defaults.
3. **Given** a group with mixed fixture models, **When** played, **Then** each fixture receives the same attribute values converted to its own channel layout; attributes a fixture does not support are ignored for that fixture.
4. **Given** the same graph applied to a single fixture, **When** played, **Then** it works with index 0, normalized index 0 and group size 1.

---

### User Story 5 - Effect clips (Priority: P2)

A user wants the truss heads to draw circles in time with the music. They place an effect clip on the timeline, choose the group, the shape "circle", size 20°, a rate of one cycle per two beats and a phase spread of 360°. In relative mode, the circle runs around whatever position a lower-priority clip sets. They add a dimmer chase effect on the same group with 2 wings so the pattern runs from the outside in.

**Why this priority**: Phaser-style effects cover most everyday moving head programming without building graphs, and tempo sync makes them fit the music automatically.

**Independent Test**: Place a position look on a lower track and a relative circle effect above it. The heads circle around the look's position, in tempo, with the configured phase offsets. Change the BPM: the effect speed follows.

**Acceptance Scenarios**:

1. **Given** an effect clip with shape, size, rate in beats and phase spread, **When** played, **Then** every fixture of the target group runs the shape at the given rate, offset by its share of the spread.
2. **Given** relative mode, **When** a lower-priority clip sets a base value, **Then** the effect is applied as an offset around it, clamped to the attribute's range.
3. **Given** absolute mode, **When** played, **Then** the effect uses its own base value and ignores lower-priority values for that attribute.
4. **Given** wings, blocks or interleave settings, **When** played, **Then** the phase assignment follows the definitions in the glossary.
5. **Given** a change of the project BPM, **When** played, **Then** effect rates follow the new tempo.
6. **Given** a color effect, **When** played, **Then** the color moves between the two configured colors following the shape (color effects are always absolute).
7. **Given** fade-in/out handles on the effect clip, **When** played, **Then** the effect size ramps from 0 to full and back.

---

### User Story 6 - Look clips with fades (Priority: P3)

A user creates a look: "Truss heads: position fanned from −30° to +30° pan, tilt 60°, blue, gobo 3". They place it on the timeline as a look clip with a two-beat fade-in. Overlapping it with the next look creates a crossfade. With fan timing, the fade ripples across the group from left to right.

**Why this priority**: Static looks with fades are the classic way of programming but can, for now, be approximated with graphs. They add a lot of convenience on top of P1/P2.

**Independent Test**: Place two looks on the timeline with overlapping fade handles. During the overlap, pan/tilt and color interpolate smoothly; the gobo switches once, at the middle of the fade.

**Acceptance Scenarios**:

1. **Given** a look clip with a fade-in, **When** played through the fade, **Then** continuous attributes (dimmer, pan, tilt, color mixing, zoom, focus) interpolate from the value they would have without the clip to the clip's value.
2. **Given** a fade involving discrete attributes (color wheel slot, gobo, prism, color macro), **When** played through the fade, **Then** they switch at the fade midpoint.
3. **Given** a look attribute with a fanned value, **When** played, **Then** the value is spread from its start to its end value across the group order, optionally mirrored.
4. **Given** fan timing on a look clip, **When** fading, **Then** each fixture's fade is delayed according to its position in the group order, and the whole fade still fits within the clip's fade handle.
5. **Given** a look that only contains some attributes, **When** played, **Then** all other attributes are left to lower-priority clips or defaults.

---

### User Story 7 - Presets (Priority: P3)

A user saves "Drummer position", "Deep blue" and "Tight beam" as presets in the library and uses them in several looks. Later the drum riser moves, so they edit "Drummer position" once, and every look using it updates.

**Why this priority**: Presets save time on longer shows and make changes cheap, but are not required to program a show.

**Independent Test**: Use one position preset in three looks. Edit the preset. All three looks show the new position without being edited.

**Acceptance Scenarios**:

1. **Given** a preset of type position, color or beam, **When** saved, **Then** it appears as an item in the library.
2. **Given** a look that references a preset, **When** the preset is edited, **Then** the look shows the updated values.
3. **Given** a preset with per-fixture values, **When** used in a look targeting a fixture that the preset has no value for, **Then** that fixture uses the preset's common value if it has one, otherwise the attribute is left unset for that fixture.
4. **Given** a preset that is used by looks, **When** the user tries to delete it, **Then** the app warns and lists the number of uses; on deletion, the looks keep the preset's last values as their own.

---

### User Story 8 - Aim at targets in the 3D scene (Priority: P3)

A user places a named aim target "Singer" on the stage in the 3D scene and sets a look or position preset to "aim at Singer". Every head in the group computes its own pan/tilt to hit that point. When a fixture is moved in the scene, it stays on target.

**Why this priority**: This is a strong differentiator that uses the existing 3D scene, but positions can also be programmed in degrees.

**Independent Test**: Place four heads at different positions and one aim target. Aim all four at the target: all beams meet at the target in the 3D preview. Move one head in the scene: its beam still hits the target.

**Acceptance Scenarios**:

1. **Given** an aim target and a group of moving heads, **When** a look aims them at the target, **Then** every head's pan/tilt points its beam at the target in the 3D preview.
2. **Given** a target that a fixture can reach in two ways (pan flipped by 180° with tilt mirrored), **When** computing, **Then** the solution with pan closest to the center of the pan range is chosen.
3. **Given** a target a fixture cannot reach within its pan/tilt range, **When** computing, **Then** the fixture points as close as possible and the look shows a warning naming the fixture.
4. **Given** an aim target that is moved or a fixture that is moved in the scene, **When** played, **Then** pan/tilt are recomputed.
5. **Given** an aim target that is deleted while in use, **When** played, **Then** the affected fixtures fall back to centered pan/tilt and the looks show a warning.

---

### Edge Cases

- A fixture's mode is changed after programming: attribute programming keeps working with the new channel layout; attributes the new mode lacks are ignored.
- The capability mapping is incomplete or wrong: the user corrects it with the existing mapping editor of the fixture's visualization; the correction applies to both programming and visualization. Fixtures without a visualization use the automatic mapping.
- A fixture has no 3D scene object: it can still be programmed by attributes; it is placed at the end of automatically ordered groups and is excluded from aiming (with a warning).
- An empty group or a group whose fixtures were all removed: clips targeting it produce no output and show a warning; they do not fail.
- A clip targets a group that is deleted: the clip shows "no target" and produces no output.
- Two clips on the same track overlap in time: they are treated as having the same priority; the one starting later wins.
- Pan/tilt crossfade between two positions uses interpolation of the angles, so the beam does not travel in a straight line in space; this is accepted.
- Color fades between two wheel-only fixtures switch at the midpoint; color fades between mixing fixtures interpolate.
- Large groups (e.g. 32 or more fixtures with a complex per-fixture graph): playback must stay at the project frame rate (see SC-005).
- 16-bit attributes driven by the raw node on only the coarse channel: the fine channel keeps its attribute or default value.
- LED strip fixtures selected as group members: not allowed in this feature; the group editor only offers DMX fixtures.

## Requirements *(mandatory)*

### Functional Requirements

**Attribute model and conversion (P1)**

- **FR-001**: The system MUST offer, for every DMX fixture, a set of attributes derived from the fixture's capability mapping, covering at least: dimmer, shutter/strobe, pan, tilt, color (RGB), color wheel, color temperature, gobo wheel, gobo rotation, prism, prism rotation, zoom, focus and pan/tilt speed, as far as the fixture supports them.
- **FR-002**: Programming and visualization MUST use the same capability mapping: the mapping of the fixture's linked visualization when one exists (so corrections in the existing mapping editor apply to both), otherwise a mapping generated automatically from the fixture definition, so that fixtures without a 3D scene object can be programmed. The existing automatic mapping and mapping editor from feature 003 MUST continue to work.
- **FR-003**: Continuous attributes MUST use natural units: dimmer, zoom, focus and speed 0–1; pan and tilt in degrees relative to the center of the fixture's range; color as RGB. Pan/tilt MUST fall back to 0–1 when the fixture definition gives no angle range, with a visible hint.
- **FR-004**: Discrete attributes (color wheel, gobo wheel, prism, color macro) MUST be selectable by the slot names from the fixture definition.
- **FR-005**: The system MUST convert attribute values to DMX values per fixture, including 16-bit coarse/fine channels.
- **FR-006**: Color MUST be converted to the fixture's color system: RGB, RGBW/RGBA and similar additive mixing, CMY subtractive mixing, or, for wheel-only fixtures, the perceptually closest color wheel slot. Split colors MUST NOT be used.
- **FR-007**: Graphs MUST offer an attribute output node that targets a fixture or a group and accepts attribute values; unconnected attributes MUST remain unset.
- **FR-008**: The raw DMX output node MUST remain available and keep its current behavior.

**Merging and playback (P1)**

- **FR-009**: Clip outputs MUST be merged per fixture and per attribute instead of per fixture. For each attribute, the clip on the higher-priority track wins (lowest track = highest priority). Within the same track, the clip that starts later wins.
- **FR-010**: Raw DMX outputs MUST take part in the same priority order at channel level: a raw channel value from a higher-priority clip overrides channels produced by attributes from lower-priority clips, and vice versa.
- **FR-011**: The output at any timeline position MUST depend only on the clips active at that position (release semantics). Jumping or scrubbing MUST give the same result as continuous playback.
- **FR-012**: Attributes that no active clip controls MUST take default values: dimmer 0, shutter open, pan and tilt centered, color white / color wheel open, gobo open, prism off, zoom and focus at the middle. Users MUST be able to override defaults per fixture.
- **FR-013**: Channels that the capability mapping does not cover MUST take the fixture definition's default value, or 0 if none is given, unless set by a raw DMX output.
- **FR-014**: The 3D preview and connected hardware MUST show the merged result.
- **FR-015**: LED strip output and existing LED strip graph nodes MUST behave as before.

**Groups and tracks (P2)**

- **FR-016**: Users MUST be able to create, rename and delete groups of DMX fixtures, with a fixture allowed in several groups.
- **FR-017**: Group order MUST be either manual or automatic. Automatic orderings MUST include left-to-right, right-to-left, front-to-back, back-to-front, bottom-to-top, top-to-bottom and distance from the stage center, based on the fixtures' positions in the 3D scene, and MUST update when fixtures move. Fixtures without a scene object come last in automatic orderings.
- **FR-018**: Tracks MUST remain free: any clip type on any track. A track MAY have a default target (group or fixture), which new clips on that track inherit and can override.
- **FR-019**: Removing a fixture from the stage MUST remove it from all groups; clips targeting missing groups or empty groups MUST show a warning and produce no output, without failing playback.

**Per-fixture graphs (P2)**

- **FR-020**: When a graph's attribute output targets a group, the system MUST evaluate the graph once per fixture of the group.
- **FR-021**: Graphs MUST offer a fixture input node providing, for the fixture currently evaluated: index, normalized index (0 for the first, 1 for the last, 0 for a single fixture), 3D position (with a flag for "no scene position") and group size.

**Effect clips (P2)**

- **FR-022**: Users MUST be able to place effect clips on the timeline with: target, attribute(s), shape, size, base value (absolute mode only), rate in beats, phase spread in degrees, wings, blocks, interleave, and direction (forward/backward along the group order).
- **FR-023**: Shapes MUST include at least: sine, triangle, sawtooth up, sawtooth down, square, and, for pan/tilt combined, circle and figure-8.
- **FR-024**: Effect clips on dimmer, pan, tilt, zoom and focus MUST support relative mode (offset around the lower-priority value, clamped to the attribute range) and absolute mode. Color effects MUST move between two configured colors and are always absolute.
- **FR-025**: Effect rates MUST follow the project tempo, and the effect phase MUST be derived from the timeline position so that playback and scrubbing agree (FR-011).
- **FR-026**: Effect clips MUST support fade-in and fade-out handles that ramp the effect size between 0 and full.

**Look clips and presets (P3)**

- **FR-027**: Users MUST be able to create look clips with a target and any subset of attributes. Each attribute value is either a single value, a fanned value (start to end across the group order, optionally mirrored), or a reference to a preset.
- **FR-028**: Look clips MUST support fade-in and fade-out handles. During a fade, continuous attributes MUST interpolate between the value without the clip and the clip's value; discrete attributes MUST switch at the fade midpoint.
- **FR-029**: Look clips MUST support optional fan timing that delays each fixture's fade according to its group order, within the length of the fade handle.
- **FR-030**: Users MUST be able to save position, color and beam presets as library items. A preset holds a common value and/or per-fixture values; position presets MAY instead aim at a target (FR-032).
- **FR-031**: Looks MUST reference presets, not copy them; editing a preset MUST update all looks using it. Deleting a preset in use MUST warn with the number of uses, and the affected looks MUST keep the preset's last values.

**Aim targets (P3)**

- **FR-032**: Users MUST be able to place, name, move and delete aim targets in the 3D scene.
- **FR-033**: Looks and position presets MUST be able to aim a target's fixtures at an aim target; pan/tilt MUST be computed per fixture from its position and orientation in the scene and its pan/tilt range.
- **FR-034**: When two pan/tilt solutions exist, the one with pan closest to the center of the pan range MUST be used. When the target is unreachable, the fixture MUST point as close as possible and the look MUST show a warning naming the fixture.
- **FR-035**: Moving an aim target or a fixture MUST update the computed pan/tilt. Fixtures aimed at a deleted target or without a scene position MUST fall back to centered pan/tilt with a warning.

**General**

- **FR-036**: All new items (groups, track default targets, per-fixture defaults, effect clips, look clips, presets, aim targets) MUST be saved with the project and restored on load.
- **FR-037**: All features MUST work in the desktop and the browser build.

### Key Entities

- **Attribute**: a semantic control of a fixture (kind, unit, range or list of named slots, continuous or discrete, default value).
- **Fixture attribute set**: the attributes a particular fixture supports, derived from its capability mapping, plus per-fixture default overrides.
- **Capability mapping**: the existing mapping from fixture channels to capabilities (feature 003), shared by programming and visualization; generated automatically for fixtures without a visualization.
- **Group**: name, member fixtures, ordering mode (manual order or one of the automatic orderings).
- **Track default target**: an optional group or fixture assigned to a timeline track.
- **Effect clip**: target, attribute(s), shape, size, base, rate in beats, phase spread, wings, blocks, interleave, direction, mode (relative/absolute), fade handles.
- **Look clip**: target, attribute values (single, fanned or preset reference), fade handles, fan timing.
- **Preset**: library item of type position, color or beam; holds a common value and/or per-fixture values, or (position only) an aim target reference.
- **Aim target**: named point in the 3D scene.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can make a newly patched moving head point at a chosen angle in a chosen color, without looking up its channel layout, in under 1 minute.
- **SC-002**: The same attribute values produce the same visible result (direction relative to mounting, color within the fixture's color capabilities, brightness) on at least three different fixture models: RGB mixing, color wheel and CMY.
- **SC-003**: A circle effect with phase spread over 8 moving heads can be created in under 2 minutes, with one clip instead of 8 graphs.
- **SC-004**: Scrubbing to any timeline position gives exactly the same DMX output as reaching that position during playback, in 100% of checked positions.
- **SC-005**: A project with 32 moving heads, one per-fixture graph over all of them, one effect clip and one look clip in overlap plays at the project's frame rate without dropped frames on the developer's reference machine (the same one as feature 003, SC-002).
- **SC-006**: Existing projects that use only raw DMX output nodes and LED strip graphs play with unchanged output.
- **SC-007**: After editing a position preset used in 3 looks, all 3 looks show the new position with no further edits.
- **SC-008**: Beams of 4 moving heads at different positions, aimed at one target, meet at the target within 0.1 m in the 3D preview (for targets in range).

## Manual Verification *(required by constitution, principle III)*

Run each step in **both** the desktop (Electron) and the browser build. Hardware verification (step 10) only in the desktop build with a connected DMX setup.

1. Patch an RGB moving head, a color wheel moving head and a CMY fixture. In a graph, add an attribute output for each and set pan 45°, tilt 30°, color red, dimmer 100%. Expected: all three point the same way relative to their mounting and show red (wheel fixture: closest red slot) in the 3D preview.
2. Set pan on a fixture without a pan range in its definition. Expected: 0–1 control with a hint. Select a gobo by name. Expected: the named gobo appears in the preview.
3. Put a position-only graph clip on a lower track and a color-only clip on the track above, overlapping. Expected: during the overlap, both apply; outside it, color is white (default). Put a dimmer clip on both tracks: the lower track wins.
4. Scrub and jump around the timeline; compare the DMX values shown in the preview with those during playback. Expected: identical.
5. Open an existing project with raw DMX output nodes and LED strip graphs. Expected: unchanged output.
6. Create the group "Heads" with 8 fixtures and switch between manual, left-to-right and distance-from-center ordering; move a fixture in the scene. Expected: the order follows. Assign the group as track default target and create a clip on the track. Expected: the clip targets the group.
7. Apply a per-fixture graph (tilt = sine of time + normalized index) to the group. Expected: a wave across the heads; adding a ninth head extends it.
8. Place a position look and a relative circle effect above it (rate 2 beats, spread 360°, then 2 wings). Expected: circles around the look position, in tempo, phases as configured; changing BPM changes the speed.
9. Place two overlapping looks with different position, color and gobo; enable fan timing on the second. Expected: smooth interpolation of position and color, the gobo switches at mid-fade, the fade ripples along the group order. Make both looks reference a position preset, edit the preset. Expected: both looks update. Aim 4 heads at an aim target, then move a head and the target. Expected: beams keep meeting at the target; an unreachable target shows a warning.
10. With real DMX hardware, play steps 1, 3 and 8. Expected: the hardware matches the preview.

## Assumptions

- Attributes are derived from the existing capability mapping (feature 003); improving automatic mapping for unusual fixtures is out of scope beyond what feature 003 provides.
- Per constitution principle IV, the project file format may change. Existing projects using raw DMX output nodes and LED strip graphs are expected to keep working (SC-006), but no migration of other data is required.
- Pan/tilt crossfades interpolate angles rather than following a straight path in space.
- "Stage center" for distance ordering is the scene origin.
- Effects are limited to continuous attributes and two-color color effects; effects that step through wheel slots or gobos are out of scope.
- Fade handles are offered on look and effect clips only; graph clips have no fade handles.
- Out of scope: LED strips in groups and per-fixture graphs (they keep their current strip nodes), grand master/blackout and other live-show features, move-in-black, console-style tracking, HTP merging, audio-driven auto-programming, a live programmer panel, animated aim targets.
