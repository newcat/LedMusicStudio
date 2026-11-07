# Feature Specification: Rendering & Fixture Capability Upgrades

**Feature Branch**: `main` (no feature branch, see project convention)

**Created**: 2026-11-07

**Status**: Draft

**Input**: User description: "Improve the visualization." Feature 3 of 3: realistic rendering of what fixtures actually do, building on the scene model & editor (001) and the asset library & model contract (002).

## Context

Today the visualization only understands a small part of what real fixtures do:

- **Moving heads** react to pan, tilt, beam angle and RGB, but not to dimmer, strobe/shutter, white, color wheels, gobos, prism or 16-bit fine channels. Pan and tilt jump instantly to new values.
- **Spots** have a fixed beam size and only react to RGBW.
- **LED strips** light up nearby surfaces, but the strip and its individual LEDs are not visible. They are limited to 8 strips, to straight lines, and to 128 color samples per strip.
- There is no haze setting, so beams always look the same. There are no visual effects for lasers, flames, smoke, CO2 or sparks.
- There are no quality settings; some effects run at a fixed, very high internal resolution regardless of window size.
- Fixture values are sent to the visualization one message per change, without grouping per frame, and also while no visualization window is open.

Feature 002 introduces models for all common fixture categories with individually identifiable emitters and a basic "glow" visualization. This feature replaces the basic glow with category-specific effects and adds the fixture capabilities needed for a realistic preview of a light show.

Related features:

1. Scene model & editor (001, prerequisite)
2. Asset library & model contract (002, prerequisite)
3. **Rendering & fixture capability upgrades** (this spec)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Beam fixtures behave like the real fixture (Priority: P1)

A user programs a moving head show and the preview reacts to all the main controls of the fixture: dimmer, shutter and strobe, color mixing (RGB, RGBW, RGBA, CMY), color wheel, white/color temperature, zoom, gobo wheel, prism and 16-bit pan/tilt. Pan and tilt move at a realistic speed instead of jumping. Pars, washes and profiles react to the same controls where they have them.

**Why this priority**: The preview is only useful for programming if what the user sees matches what the real fixture will do. Dimmer and strobe in particular are used in nearly every show.

**Independent Test**: Map a moving head's channels, then step through dimmer, strobe, each color mixing mode, color wheel slots, zoom, gobo and prism values, and confirm the preview reacts to each.

**Acceptance Scenarios**:

1. **Given** a fixture with a mapped dimmer channel, **When** the dimmer goes from 0 to full, **Then** the beam, the lit surfaces and the lens brightness go from off to full brightness.
2. **Given** a mapped shutter/strobe channel, **When** a strobe value is set, **Then** the light flashes at the corresponding rate; closed shutter means no light; open shutter means steady light.
3. **Given** a fixture with RGBW, RGBA or CMY color mixing, **When** the color channels change, **Then** the displayed color matches the mixing model (e.g. CMY full = dark, RGBW white channel adds white).
4. **Given** a fixture with a color wheel, **When** the wheel channel selects a slot, **Then** the beam takes on that slot's color as described in the fixture definition; split colors and continuous wheel rotation are shown as a transition.
5. **Given** a mapped zoom channel, **When** zoom changes, **Then** the beam angle changes within the fixture's angle range.
6. **Given** a gobo wheel channel, **When** a gobo is selected, **Then** the beam and the light on surfaces show a pattern (the gobo image from the fixture definition if available, otherwise a generic pattern); gobo rotation is shown.
7. **Given** a prism channel, **When** the prism is engaged, **Then** the beam is split into several beams.
8. **Given** pan and tilt with fine channels, **When** values change, **Then** positioning uses the full 16-bit resolution.
9. **Given** realistic movement is enabled (default), **When** pan changes from one end to the other, **Then** the head moves there over a fraction of a second instead of jumping instantly, at a configurable speed.

---

### User Story 2 - Channel mapping configures itself from the fixture definition (Priority: P1)

When a user creates a visualization for a DMX fixture from the open fixture library, all supported capabilities (pan, tilt, fine channels, dimmer, shutter/strobe, color channels, color wheel with its slot colors, zoom with its angle range, gobo wheel, prism) are mapped automatically from the fixture definition. The user can review and correct the mapping.

**Why this priority**: Mapping many capabilities by hand would make the new capabilities unusable in practice.

**Independent Test**: Create visualizations for five different fixtures from the open fixture library and confirm all supported capabilities are mapped correctly without manual work.

**Acceptance Scenarios**:

1. **Given** a fixture definition with pan, tilt, dimmer, strobe, color wheel and zoom, **When** the visualization is created, **Then** all of these are mapped, including value ranges (e.g. pan range in degrees, zoom angle range, strobe value ranges).
2. **Given** a channel whose capability is ambiguous or unsupported, **Then** it is left unmapped and shown as such in the mapping view.
3. **Given** an auto-mapped visualization, **When** the user changes a mapping manually, **Then** the change is kept and not overwritten unless the user triggers auto-assign again.
4. **Given** a fixture definition that uses different modes, **Then** the mapping uses the channels of the fixture's selected mode.

---

### User Story 3 - Haze, beams and light on the stage (Priority: P1)

The user sets a haze level for the scene. With no haze, beams are almost invisible and only the light on surfaces shows; with dense haze, beams are bright and solid. Light from fixtures illuminates the stage, decoration and floor with the right color and shape, including gobo patterns.

**Why this priority**: Haze is the single biggest factor in how a light show looks and is needed to judge beam effects and lasers.

**Independent Test**: With four moving heads aimed at the floor, change haze from 0 to maximum and confirm beam visibility changes; confirm the floor shows the light spots in the right colors.

**Acceptance Scenarios**:

1. **Given** haze is set to 0, **Then** beams are nearly invisible and only lit surfaces and lenses show the light.
2. **Given** haze is increased, **Then** beams become progressively more visible.
3. **Given** a fixture is pointed at a surface, **Then** the surface shows a light spot with the beam's color, size and gobo pattern, getting dimmer and wider with distance.
4. **Given** shadows are enabled in the quality settings, **Then** objects between a fixture and a surface cast shadows.
5. **Given** a beam passes through an object, **Then** the beam is cut off at the object (when shadows are enabled).

---

### User Story 4 - LED strips and pixel fixtures show individual pixels (Priority: P1)

A user sees each LED of a strip as an individual glowing point along the strip, with the correct pixel count. LED bars, pixel bars, blinders and LED panels show each cell individually when the fixture definition controls cells separately. LED strips can be drawn as freeform shapes (multiple segments or curves) along walls, the stage edge or the DJ booth.

**Why this priority**: LED strips and pixel fixtures are a core use case of the app (it started as an LED music studio), and pixel effects like chases are invisible without per-pixel display.

**Independent Test**: Create a 300-pixel strip drawn around the edge of a platform, run a chase effect, and confirm each pixel lights individually and in the right order.

**Acceptance Scenarios**:

1. **Given** an LED strip fixture with N pixels, **Then** the visualization shows N individually colored points evenly spaced along the strip.
2. **Given** a strip is drawn as a polyline or curve on surfaces, **Then** pixels follow the drawn path in order from start to end.
3. **Given** a running chase effect, **Then** the light pattern moves along the strip, and surfaces near the strip are lit by the nearby pixels' colors.
4. **Given** a multi-cell fixture (e.g. a 12-cell pixel bar) with per-cell channels, **Then** each cell shows its own color and intensity.
5. **Given** a scene with 50 strips of 300 pixels each, **Then** all strips display correctly with no limit on the number of strips.

---

### User Story 5 - Special effect fixtures (Priority: P2)

Lasers, flame projectors, CO2 jets, cold spark machines, hazers/fog machines, strobes and blinders each have a dedicated visual effect that reacts to their mapped channels.

**Why this priority**: Expands the preview to the full range of the asset library (feature 002), but most shows rely primarily on beam and LED fixtures.

**Independent Test**: Place one fixture of each special effect type, trigger each one, and confirm the dedicated effect appears and reacts to its channels.

**Acceptance Scenarios**:

1. **Given** a laser fixture, **When** it is on, **Then** it shows thin, bright beams (single beam or fan) whose color, number/pattern, movement and visibility depend on the mapped channels and the haze level; where the beams hit surfaces, dots or lines are visible.
2. **Given** a flame projector, **When** it is triggered, **Then** a flame column appears for as long as the trigger is active, with a height following the mapped channel if present, and lights its surroundings with a warm flicker.
3. **Given** a CO2 jet, **When** triggered, **Then** a white plume shoots up and dissipates after the trigger ends.
4. **Given** a cold spark machine, **When** triggered, **Then** a fountain of sparks appears with a height following the mapped channel if present.
5. **Given** a hazer or fog machine, **When** its output channel is active, **Then** visible fog is emitted, and the scene's effective haze level increases gradually while it runs and decays afterwards (if the user enables this coupling).
6. **Given** a strobe or blinder, **When** flashed, **Then** it produces very bright flashes that light up the scene, with strobe rate and intensity from the mapped channels; multi-cell blinders light cells individually.

---

### User Story 6 - Quality settings and stable performance (Priority: P2)

The user chooses a quality level (low, medium, high) for the editor and, separately, for the show window. Low quality keeps the preview smooth on weak hardware or large scenes; high quality enables shadows and more realistic lighting. An optional performance overlay shows the frame rate. When no visualization is visible, no rendering work is done.

**Why this priority**: The added effects cost performance. Without quality control, large scenes would become unusable, but medium quality is a reasonable default.

**Independent Test**: Load the reference scene (SC-002), switch between quality levels, and confirm the frame rate and visual quality change accordingly; close all visualization views and confirm that CPU/GPU load drops.

**Acceptance Scenarios**:

1. **Given** the reference scene, **When** the user switches from high to low quality, **Then** the frame rate increases noticeably and the preview stays recognizable (beams, colors and positions identical).
2. **Given** the editor and the show window, **Then** each has its own quality level.
3. **Given** the performance overlay is enabled, **Then** the current frame rate is shown.
4. **Given** the visualization tab is not shown and the show window is closed, **Then** no rendering work is done and playback performance of the rest of the app is unaffected.
5. **Given** the window is resized, **Then** effect resolution adapts to the window size.

---

### User Story 7 - Ambient and house lighting (Priority: P3)

The user sets the environment lighting: from a completely dark venue (only fixtures emit light) to dim house lights or daylight, so the stage layout is visible while editing and the show looks realistic during playback.

**Why this priority**: Helpful for editing in the dark and for previewing different venue situations, but not essential.

**Independent Test**: Switch between "dark", "house lights" and "daylight" presets and adjust the brightness, confirming the stage geometry becomes visible or hidden accordingly.

**Acceptance Scenarios**:

1. **Given** the "dark" setting, **Then** only light from fixtures illuminates the scene.
2. **Given** the editor and the show window, **Then** each can use a different ambient setting (e.g. house lights in the editor, dark in the show window).

---

### Edge Cases

- More fixtures light surfaces than the current quality level can render in real time: the most important lights (brightest and closest to the camera view) get full surface lighting; the rest still show beams, lenses and approximate lighting. No light disappears entirely.
- A fixture definition has a color wheel slot without a defined color, or a gobo without an image: a neutral approximation (white / generic pattern) is shown.
- A strobe value faster than the display refresh rate: flashing is shown at a rate the display can render, without becoming a steady light.
- Fixture values arrive faster than the display refresh rate: only the latest value per frame is used, and no frames are skipped because of message processing.
- A strip has a very high pixel count (e.g. 2000 pixels) or a very short length: all pixels are shown; pixels may merge visually but stay in order.
- A freeform strip path crosses itself or has very short segments: pixels are still distributed evenly along the path.
- Pan/tilt values change while the head is still moving with realistic speed: the head redirects smoothly to the new target.
- The browser or hardware does not support an effect at the selected quality: the app falls back to a lower quality for that effect and shows a one-time notice; it does not crash.
- Strobing and blinder flashes may trigger photosensitivity: a setting limits the maximum flash rate in the preview (default on, at 3 flashes per second, with an option to show the true rate).

## Requirements *(mandatory)*

### Functional Requirements

**Fixture capabilities**

- **FR-001**: Beam fixture visualizations (spot/par, wash, profile, moving head, scanner) MUST support these capabilities where mapped: dimmer, shutter (open/closed), strobe rate, RGB, RGBW, RGBA and CMY color mixing, white/color temperature, color wheel (including split colors and continuous rotation), zoom/beam angle, gobo wheel (selection and rotation), prism, and pan/tilt with 16-bit fine channels.
- **FR-002**: Moving parts MUST move with a realistic, configurable maximum speed (default on); users MUST be able to switch to instant movement.
- **FR-003**: Unmapped capabilities MUST use sensible defaults: full intensity when no dimmer is mapped, open shutter when no shutter is mapped, white when no color is mapped.
- **FR-004**: Color wheel slot colors and gobo images MUST be taken from the fixture definition when available, with neutral fallbacks otherwise.

**Automatic channel mapping**

- **FR-010**: When a visualization is created for a DMX fixture from the fixture library, all capabilities of FR-001 MUST be mapped automatically from the definition of the fixture's selected mode, including value ranges (angles, strobe rate ranges, wheel slot ranges).
- **FR-011**: The mapping view MUST show mapped and unmapped capabilities and allow manual correction. Manual changes MUST persist until the user explicitly re-runs auto-assign.

**Haze, beams and lighting**

- **FR-020**: The scene MUST have a haze level setting (0–100%) stored in the project that controls beam visibility for all beam and laser fixtures.
- **FR-021**: Fixtures MUST light surfaces in the scene with their color, beam shape and gobo pattern, with brightness falling off with distance.
- **FR-022**: At high quality, objects MUST cast shadows from fixture light and beams MUST be cut off where they hit objects.
- **FR-023**: When more lights are active than can be rendered in real time at the current quality, lights MUST be prioritized by brightness and visibility; lower-priority lights MUST still show beams and lenses and contribute approximate lighting.

**LED strips & pixel fixtures**

- **FR-030**: LED strip visualizations MUST show every pixel individually with its color, at the fixture's actual pixel count, evenly distributed along the strip.
- **FR-031**: Users MUST be able to draw LED strips as polylines and smooth curves, by clicking points on surfaces in the editor (extending feature 001), and edit the points afterwards.
- **FR-032**: LED strips MUST light nearby surfaces based on the colors of the nearby pixels.
- **FR-033**: There MUST be no fixed limit on the number of LED strips or pixels per strip; performance targets are defined in SC-003.
- **FR-034**: Multi-cell fixtures (LED bars, pixel bars, blinders, LED panels) MUST drive each emitter cell defined in their model (feature 002) individually when the fixture definition provides per-cell channels.

**Special effects**

- **FR-040**: The visualization MUST provide dedicated effects for: laser (beams/fans with color, pattern and movement; visible with haze; dots/lines on surfaces), flame projector (flame column with height and flickering warm light), CO2 jet (plume that dissipates), cold spark machine (spark fountain with height), hazer/fog machine (visible fog; optional coupling to the scene haze level), strobe and blinder (bright flashes lighting the scene, per-cell where available).
- **FR-041**: Each special effect MUST react to the corresponding mapped channels (on/trigger, intensity, color, height, pattern, rate) as available in the fixture definition, with automatic mapping per FR-010 where the definition allows.

**Quality & performance**

- **FR-050**: Users MUST be able to choose a quality level (low, medium, high) separately for the editor and the show window, stored per user (not in the project). Medium MUST be the default.
- **FR-051**: Effect resolution MUST adapt to the size of the view.
- **FR-052**: An optional performance overlay MUST display the current frame rate.
- **FR-053**: When no visualization view is visible, the visualization MUST perform no rendering work and the app MUST NOT send fixture updates to it.
- **FR-054**: Fixture updates MUST be applied at most once per displayed frame per view, using the latest value.
- **FR-055**: If an effect is unsupported by the device at the chosen quality, it MUST fall back to a simpler version and show a one-time notice.

**Environment & safety**

- **FR-060**: The scene MUST offer ambient lighting presets (dark, house lights, daylight) with adjustable brightness, selectable separately for the editor and the show window.
- **FR-061**: A photosensitivity setting MUST limit the preview's maximum flash rate (default on, 3 flashes per second), with the option to display the true rate.

**Platform**

- **FR-070**: All capabilities MUST work in both the desktop and browser versions of the app.

### Key Entities

- **Capability Mapping**: The link between a fixture's channels and a visualization capability (pan, tilt, dimmer, strobe, color wheel, ...), with value ranges and default values; auto-generated from the fixture definition and editable.
- **Color Wheel / Gobo Wheel**: The list of slots of a fixture's wheel with their color or pattern image, taken from the fixture definition.
- **Haze Setting**: The scene's haze density (0–100%), optionally increased by active hazers/fog machines.
- **Quality Level**: A per-view, per-user setting (low/medium/high) controlling shadows, the number of fully rendered lights and effect resolution.
- **Ambient Setting**: A per-view lighting environment preset with brightness.
- **LED Strip Path**: The ordered sequence of points (polyline or curve) along which a strip's pixels are distributed.
- **Emitter Cell**: An individually controlled light-emitting part of a fixture model (defined in feature 002), bound to channels via the capability mapping.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For 10 popular fixtures from the open fixture library (moving heads, washes, pars, pixel bars, lasers), 100% of the capabilities listed in FR-001 that the fixture supports are mapped automatically and react correctly in the preview.
- **SC-002**: The reference scene (40 moving heads, 20 pars, 10 pixel bars, 4 lasers, 2 hazers, 20 LED strips with 300 pixels each, haze 50%) renders smoothly at medium quality on the developer's reference machine (at least 50 frames per second in the show window).
- **SC-003**: The same reference scene stays at least at 30 frames per second at low quality on a typical integrated-graphics laptop.
- **SC-004**: The visible reaction to a fixture value change (e.g. dimmer to full) appears within 2 displayed frames.
- **SC-005**: Users comparing the preview to the real fixture behavior for dimmer, strobe, color and position judge them as matching in at least 9 out of 10 test cues.
- **SC-006**: With all visualization views closed or hidden, the visualization causes no measurable additional CPU/GPU load.
- **SC-007**: A strobe effect at a requested rate of 10 Hz is visibly flashing (not steady) when the photosensitivity limit is disabled.

## Manual Verification *(required by constitution, principle III)*

Run each step in **both** the desktop (Electron) and the browser build. Hardware verification (step 9) only in the desktop build with a connected DMX setup.

1. Add a moving head from the open fixture library. Expected: all FR-001 capabilities auto-mapped. Step through dimmer, shutter, strobe, color mixing, color wheel slots, zoom, gobo, prism and fine pan/tilt; expected: each visibly reacts; pan/tilt moves smoothly at realistic speed.
2. Repeat step 1 for a wash, a par with RGBW, and a CMY fixture.
3. Aim four moving heads at the floor and vary haze from 0 to 100%. Expected: beams go from invisible to solid; floor spots show colors and gobos. Enable high quality; expected: shadows and beams cut off by objects.
4. Draw a 300-pixel LED strip as a curve around a platform and run a chase. Expected: individual pixels in order, surfaces lit nearby. Add a 12-cell pixel bar; expected: per-cell colors.
5. Place a laser, flame projector, CO2 jet, cold spark machine, hazer, strobe and blinder; trigger each. Expected: the dedicated effect appears and follows its channels; the hazer increases haze when coupling is enabled.
6. Build the reference scene from SC-002. Switch quality levels in editor and show window; enable the performance overlay. Expected: frame rates meet SC-002/SC-003; visuals stay consistent across levels.
7. Hide the visualization tab and close the show window. Expected: load drops and no updates are sent.
8. Switch ambient presets in editor and show window independently. Toggle the photosensitivity limit and verify the strobe rate limit.
9. With real DMX hardware, play the same cues as on the preview. Expected: dimmer, strobe, color and position match (SC-005).

## Assumptions

- The goal is a convincing, real-time preview for show programming, not a physically accurate photometric simulation.
- The fixture definitions come from the open fixture library already used by the app; their capability descriptions, wheel definitions and gobo resources (where present) are the source of truth for automatic mapping.
- LED strip fixtures (non-DMX) already provide a pixel count and per-pixel colors; DMX pixel fixtures provide per-cell channels through their definition's matrix information.
- Effect visuals for special effects (flames, CO2, sparks, fog) are stylized approximations.
- Quality level and photosensitivity settings are user preferences stored outside the project; haze and the strip paths are stored in the project.
- Mapping of video content to LED panels/walls, audio-reactive visualization beyond fixture values, and video/screenshot recording are out of scope.
- Project file compatibility may break (constitution principle IV); commit messages must say so if it does.
