# Data Model: Rendering & Fixture Capability Upgrades

**Feature**: 003-rendering-capabilities | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

Types are defined in [contracts/capability-mapping.ts](./contracts/capability-mapping.ts), [contracts/scene-state-delta.ts](./contracts/scene-state-delta.ts) and [contracts/renderer-api.ts](./contracts/renderer-api.ts). This document gives meaning, defaults, ranges, relationships, load rules and state transitions.

Where data lives:

| Data | Stored in | Who changes it |
|---|---|---|
| Capability mapping, wheels, cells, movement, effect options | `FixtureVisualizationObject.config` (project) | Auto-mapper on creation and Auto-Assign; the user in the mapping editor |
| LED strip path | `LedStripVisualizationConfig.path` (project) | Strip drawing tool, inspector |
| Haze, hazer coupling, ambient per view | `SceneState.environment` (project) | Environment popover (undoable) |
| Quality per view, FPS overlay, flash limit | `localStorage["lms.viewPreferences"]` (per user) | Display popover, show window gear menu |
| Effective haze, movement positions, strobe phase, particles, light tiers | Memory, per view | Render loop |

---

## 1. Capability Mapping

`CapabilityMapping { channels, wheels, cells, mappedMode, mappedChannelCount }`, one per DMX visualization object.

### Keys by visualization type (`KEYS_BY_TYPE`, `capabilities/keys.ts`)

| Type | Keys |
|---|---|
| Moving Head | pan, tilt, panTiltSpeed\*, dimmer, shutter, red, green, blue, white, amber, uv, lime, indigo, warmWhite, coldWhite, cyan, magenta, yellow, colorTemperature, colorMacro, colorWheel, colorWheelRotation, zoom, goboWheel, goboWheelRotation, goboRotation, prism, prismRotation |
| Spot | same as Moving Head without pan, tilt, panTiltSpeed |
| Generic Fixture | dimmer, shutter, red, green, blue, white, amber, uv, lime, indigo, warmWhite, coldWhite, colorTemperature, colorMacro + `cells` |
| Laser | dimmer, shutter, red, green, blue, colorMacro, laserPattern, laserSize, laserRotation, laserX, laserY, laserSpeed, pan, tilt |
| Flame / Cold Spark | trigger, height |
| CO2 Jet | trigger |
| Fog / Haze | fogOutput |
| LED strip | — (no DMX mapping; colors come per pixel) |

\* `panTiltSpeed` is mapped and shown, but only used to scale the realistic movement speed (0 = fast = configured speed, 255 = 10 %). If it is unmapped, the configured speed is used.

### CapabilityChannel fields and validation

| Field | Rule |
|---|---|
| `channel` | Integer −1 … mode channel count − 1. A value outside the range (fixture mode changed) is treated as unmapped at runtime and flagged in the editor. |
| `fine` | −1, or a channel index ≠ `channel`. When ≥ 0, raw = `coarse·256 + fine` and segment bounds are scaled ×257 (8-bit bounds → 16-bit). |
| `segments` | Sorted by `from`, non-overlapping, `0 ≤ from ≤ to ≤ 255` (8-bit bounds; the 16-bit scaling is applied at decode). A raw value matching no segment keeps the previous decoded value (OFL "hold"). An empty list for a linear key means one implicit linear segment 0…255 → the key's default range (below). |
| `defaultValue` | Used when `channel = −1`. |
| `source` | `"auto"` after auto-mapping, `"manual"` after any user edit of this entry. |
| `wheel` | Required for colorWheel, colorWheelRotation, goboWheel, goboWheelRotation and prism (when the prism comes from a wheel slot). Must name an entry in `wheels`. |

### Defaults when unmapped (FR-003) and default ranges

| Key | Unit | Default when unmapped | Default linear range |
|---|---|---|---|
| pan / tilt | ° | 0 (rest pose) | model `movingParts` min…max (002), else −270…270 / −135…135 |
| dimmer | 0..1 | **1** (full) | 0…1 |
| shutter | gate | **open** | — (segments) |
| red … coldWhite, cyan/magenta/yellow | 0..1 | 0. If *no* color key is mapped at all, the mix is **white** | 0…1 |
| colorTemperature | K | none (neutral) | 2700…8000 |
| colorWheel / goboWheel | slot | 1 (usually open) | — |
| zoom | ° | `BeamVisualizationConfig.defaultBeamAngle` | OFL zoom angles → lens `degreesMinMax` → 10…45 |
| goboRotation / prismRotation | rps | 0 | −1…1 |
| prism | facets | 0 (out) | — |
| trigger | on/off | **off** (research R14) | on when > 50 % (≥ 128) |
| height | 0..1 of maxHeight | 1 | 0…1 |
| fogOutput | 0..1 | 0 | 0…1 |
| laserPattern | pattern | `options.pattern` | — |
| laserSize / laserRotation / laserX / laserY / laserSpeed | 0..1, rps, −1..1 | 0.5 / 0 / 0 / 0 / 0.5 | as listed |

### Wheels

`WheelDefinition { slots, direction }` is copied from `definition.wheels[name]` (research R3, R9):

| OFL slot | Stored as | Fallback |
|---|---|---|
| `Open` | `{ type: "open" }` | — |
| `Closed` | `{ type: "closed" }` (intensity 0) | — |
| `Color` with `colors` | `{ type: "color", colors (1 or 2), temperature: null }` | — |
| `Color` with only `colorTemperature` | `{ type: "color", colors: [], temperature: K }` | — |
| `Color` with neither | `{ type: "color", colors: ["#ffffff"] }` | neutral white (edge case) |
| `Gobo` with an embedded SVG ≤ 32 KB | `{ type: "gobo", image: <svg> }` | — |
| `Gobo` without image / other format / too large | `{ type: "gobo", image: "generic:<(slotIndex) mod 12>" }` | generic pattern (edge case) |
| `Prism` | `{ type: "prism", facets: facets ?? 3 }` | — |
| `Frost`, `Iris` | stored. Frost raises softness by 0.5; iris scales the beam angle | — |
| `AnimationGoboStart/End` | `{ type: "gobo", image: "generic:11" }` | — |

Slot numbers in segments are 1-based like OFL. Fractional slot positions blend: color = mix of neighbouring colors; gobo = `gobo`/`goboNext` with `goboBlend`.

### Cells (FR-034)

`CellMapping[]` exists only for Generic Fixture with a matrix definition.
- **Pixel order**: the OFL `matrix.pixelKeys` (or numeric keys 1…n from `pixelCount`) in X, then Y, then Z order.
- **Emitter binding**: model emitters are sorted by id (natural sort of `cell-<n>` / `cell-<row>-<col>`). Pixel *i* of *P* is bound to emitter `floor(i · E / P)`. With more pixels than emitters, the emitter shows the average of its pixels. With fewer, the remaining emitters copy the nearest pixel.
- **Without model cells**: if the model has no `cell-*` emitters, all emitters show the average color.
- **Fixture-wide keys still apply**: `dimmer` and `shutter` multiply every cell. If a cell has no color channels, it uses the fixture color.

### Mode tracking

- `mappedMode` holds the fixture mode name at mapping time.
- The editor shows the outdated notice when `fixture.config.mode?.name !== mappedMode` or `channelNames.length !== mappedChannelCount`.
- The mapping is never changed automatically after creation.

---

## 2. Per-type configs

See [contracts/scene-state-delta.ts](./contracts/scene-state-delta.ts).

| Config | Field | Default | Range |
|---|---|---|---|
| Beam | `movement.mode` | `"realistic"` | realistic / instant |
| | `movement.panSpeed` / `tiltSpeed` | 600 / 400 °/s | 30…1500 |
| | `defaultBeamAngle` | OFL lens min angle, else 15 | 1…120 |
| | `softness` | profile 0.1, spot/moving-head-spot 0.25, par 0.4, wash/fresnel 0.7 (by model id) | 0…1 |
| | `prismSpread` | 6 | 1…30 |
| Generic | `surfaceLight` | true for strobe, blinder, LED bar, pixel bar, LED panel models; false for generic and nozzle models | |
| | `lightAngle` | blinder 90, strobe 120, bars/panels 60, else 90 | 10…170 |
| LED strip | `intensity` | 1 | 0…1 |
| | `path` | two points: (−0.5, 0, 0) and (0.5, 0, 0), normals (0, 1, 0), linear, open | ≥ 2 points; coordinates finite; normals normalized (zero → (0, 1, 0)) |
| | `pixelSize` | 0.6 | 0.2…1 |
| Effect | `options` | by type (data in scene-state-delta.ts) | heights 0.5…15 m, beams 1…64, spread 1…180° |

---

## 3. LED Strip Path

- **Points**: object-local `position`/`normal` pairs. The object transform moves, rotates and scales the whole strip.
- **Geometry**:
  - `linear`: straight segments.
  - `curve`: centripetal Catmull-Rom through the points (closed if `closed`), sampled at 16 samples per segment for the arc-length table.
- **Pixels**: N = the fixture's pixel count (the value length / 3). If unlinked, N = round(length × 30). Pixel *i* sits at arc length `(i + 0.5) / N · L`. Its normal is interpolated from the point normals by arc length.
- **Segments for surface light** (research R10): about 0.5 m long, at least 1 per strip, rounded to whole pixels. LOD halves the segment count per strip, starting with the farthest strips, until the total fits the quality budget.
- **Validation**: fewer than 2 distinct points → the default path. A total length < 1 cm → pixels are placed at the first point (all visible, in order).

---

## 4. Scene Environment

| Field | Default | Range | Notes |
|---|---|---|---|
| `haze` | 0.3 | 0…1 | UI in %. |
| `hazerCoupling` | false | | |
| `ambient.editor` | `{ preset: "house", brightness: 1 }` | brightness 0…2 | |
| `ambient.show` | `{ preset: "dark", brightness: 1 }` | | |

Ambient presets (`environment.ts`):

| Preset | Hemisphere sky / ground | Intensity × brightness |
|---|---|---|
| dark | — | 0 (only fixtures light the scene, US7.1) |
| house | 2700 K / 0.5 × sky | 0.15 |
| daylight | 6500 K / grey | 1.2 |

**Effective haze** (per view, not stored):

```
h(t+dt) = h + dt · (Σ fogOutput_i · contribution_i − h) / τ
```

- τ = 8 s while the sum is above `h`, 30 s while it is below.
- `effectiveHaze = clamp(haze + h, 0, 1)` while coupling is on, otherwise `haze`.

---

## 5. Quality Level and View Preferences

- `QualityLevel` is `"low" | "medium" | "high"`, per view (editor/show), default `"medium"`. The profiles are in research R12.
- The `ViewPreferences` record lives in `localStorage["lms.viewPreferences"]`. Unknown or invalid values fall back to the defaults (medium, FPS off, limit on, true rate off). The record is written as a whole and versioned with `{ v: 1, ... }`.
- **Fallback state** (memory only): a set of downgraded features per view, kept until the view is disposed.

---

## 6. Runtime state per view (not stored)

| Entity | Fields | Lifetime |
|---|---|---|
| `RendererRuntime` (beam) | the smoothed pan, tilt, zoom, wheel position, their velocities; the rotation angles of the gobo/prism/wheel; the strobe phase | per renderer |
| `PendingValue` | latest `Uint8Array` per object id, plus a dirty flag | per view; applied once per frame |
| `LightRecord` | params (renderer-api.ts), score, tier (`full` / `simple` / `overflow`), shadow tile | per `LightHandle` |
| `GoboTile` | hash → tile index, reference count | per view |
| `ParticlePool` | positions, velocities, ages, colors (Float32Array), count | per effect renderer, sized by quality |
| `HazeAccumulator` | `h`, outputs per fog object | per view |

### State transitions

**View activity (FR-053):**

```
created ──(visible ∧ size > 0)──▶ active ──(hidden ∨ size = 0 ∨ document hidden)──▶ inactive
   inactive: no rAF; values → PendingValue only; sink.active = false → no values sent
   inactive ──(visible)──▶ active: apply all pending values, emit onActivated → server sends full state
```

**Show window in the main window (protocol v3):**

```
unknown ──hello──▶ alive(visible=true) ──heartbeat(visible)──▶ alive(visible)
alive ──bye ∨ 6 s without heartbeat──▶ gone
sink.active = ∃ alive ∧ visible
```

**Realistic movement:** see research R6. Retargeting keeps the current velocity, so the movement redirects smoothly.

**Light tier (FR-023), per frame:**
1. Score every light and sort.
2. Assign `full` to ranks < fullLights, `simple` to ranks < fullLights + simpleLights, `overflow` to the rest.
3. A light changes tier only if its score beats the boundary by 15 %.
4. Shadow tiles go to the first `shadowLights` full lights (high quality only).

**Effect trigger (Flame / CO2 / Spark):**

```
off ──trigger ≥ 128──▶ on (emit particles, light on)
on ──trigger < 128──▶ fading
fading ──(all particles dead | flame 0.3 s, CO2 1.5 s, spark 1 s)──▶ off
```

**Strip drawing tool (editor):**

```
idle ──Draw──▶ drawing ──click──▶ drawing(+point) ──Enter/dblclick (≥ 2 points)──▶ committed → idle
drawing ──Esc──▶ cancelled → idle (new strip removed / old path kept)
idle ──Edit path──▶ editing ──drag/insert/delete──▶ editing (each = one undo step) ──Esc/click away──▶ idle
```

---

## 7. Relationships

```text
DmxFixture (stage) ──definition+mode──▶ autoMapCapabilities ──▶ CapabilityMapping (in object config)
FixtureVisualizationObject ──modelId──▶ FixtureAssetDefinition (002) ──emitters──▶ CellMapping.emitter
CapabilityMapping.channels[k].wheel ──▶ CapabilityMapping.wheels[name] ──gobo image──▶ GoboAtlas tile (per view)
Renderer (per object, per view) ──LightHandle──▶ SurfaceLighting ──uniforms──▶ every LED-lit material
LedStripRenderer ──StripHandle──▶ SurfaceLighting (segments)
FogRenderer ──reportHazeOutput──▶ EnvironmentState ──haze──▶ beam & laser shaders
SceneState.environment ──environmentChanged──▶ every SceneView
ViewPreferences (localStorage) ──▶ SceneView.setQuality / setFlashLimit (editor and show window)
```

---

## 8. Load rules (sanitize, `src/scene/model/sanitize.ts`)

Old projects keep loading (constitution IV). No breaking-change notice is needed unless the implementation drops one of these rules.

1. **Missing `environment`**: use the defaults from section 4. Values are clamped and invalid presets replaced.
2. **Old Moving Head config** (`config.channelMapping.pan/tilt/beamAngle` as `{ channel, defaultValue, min, max }`, plus `red/green/blue` as numbers):
   - Convert to `BeamVisualizationConfig`.
   - pan, tilt and zoom become linear entries with segment 0…255 → min…max and `defaultValue` (beamAngle → zoom, and its `defaultValue` → `defaultBeamAngle`).
   - red, green and blue become linear 0…1 entries.
   - All entries get `source: "manual"`, `mappedMode: null` and default movement.
   - Without a dimmer, intensity is full (FR-003), so old scenes look the same apart from realistic movement.
3. **Old Spot config** (`colorChannels: [r, g, b, w]`): convert to `BeamVisualizationConfig` with red/green/blue/white entries (manual).
4. **Old Generic config** (`channelMapping.intensity/red/green/blue/white`): convert to `GenericVisualizationConfig` (intensity → dimmer; `surfaceLight` from the model default).
5. **Old LED strip config** (`start`, `end`): `path = { points: [start, end], normals (0, 1, 0), linear, open }`, `pixelSize` 0.6.
6. **Mapping repair**: keys not in `KEYS_BY_TYPE` of the type are dropped. Segment lists are sorted, clipped to 0…255 and stripped of overlaps. `wheel` references to missing wheels are removed (entry kept, slots → open). A `problems` entry is added for each repaired object.
7. **New visualization types** in files loaded by older builds: unknown types become groups (existing 002 rule). Accepted, no forward compatibility promised (constitution IV).

---

## 9. Asset catalog changes (feature 002 data)

| Model | `visualizationTypes` | Added |
|---|---|---|
| fixture.laser | LASER, GENERIC | (beam exists) |
| fixture.flame-projector | FLAME, GENERIC | `beam` at the nozzle, +Y |
| fixture.co2-jet | CO2_JET, GENERIC | `beam` at the nozzle, +Y |
| fixture.cold-spark | COLD_SPARK, GENERIC | `beam` at the outlet, +Y |
| fixture.fog-machine | FOG, GENERIC | `beam` at the nozzle, +Z |

`categoryMapping.ts` (002, research R13) chooses: Laser → LASER; Smoke/Hazer → FOG; and Effect/Flower/Fan/Stand/Other with flame/co2/spark names → FLAME / CO2_JET / COLD_SPARK. Strobe, Blinder, Pixel Bar and Matrix stay GENERIC.

The validator rule is extended: models whose `visualizationTypes` contain SPOT, MOVING_HEAD, LASER, FLAME, CO2_JET, COLD_SPARK or FOG must have `beam`.

---

## 10. Reference scene (SC-002)

`specs/003-rendering-capabilities/reference-scene.lmp` is built during implementation. It is a project file with 40 moving heads (mixed spot/wash, Stairville MH-X50 profile), 20 RGBW pars, 10 pixel bars (12 cells), 4 lasers, 2 hazers and 20 LED strips × 300 pixels on platforms and truss, haze 50 %. It is used by quickstart scenario Q12 for frame-rate measurements. The DMX values come from a looping timeline pattern stored in the same project.
