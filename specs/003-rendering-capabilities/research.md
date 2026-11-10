# Research: Rendering & Fixture Capability Upgrades

**Feature**: 003-rendering-capabilities | **Date**: 2026-11-09 | **Plan**: [plan.md](./plan.md)

Each decision lists what was chosen, why, and what else was considered. The "current state" notes come from reading the code at commit `631329f`.

---

## R1. Where DMX values become a visual state: in the view, from raw channels

**Decision**: Fixture values stay **raw** on the wire (DMX channel bytes, RGB bytes for LED strips). Every view decodes them itself with pure functions in a new module, `src/visualization/capabilities/`: `beamState.ts`, `cellState.ts`, `effectState.ts`, `colorMath.ts`, `strobe.ts` and `movement.ts`. The decoders take the capability mapping (from the object config), the latest raw values, the frame time and the previous state, and return a typed state (`BeamState`, `CellState`, `EffectState`) that the renderer applies.

**Rationale**: Strobe phase, wheel rotation, gobo rotation, realistic movement and particle emission all depend on the frame time of the view, so the decoding has to run per view and per frame anyway. Raw values are small and protocol-stable. The config, and with it the mapping, already reaches every view (`fixtureConfigs`). The module has no Vue or Pinia imports, so the show window bundle can use it. The decoders are pure, so they are the obvious place for optional unit tests (constitution III).

**Alternatives considered**: Decoding in the main window (in `FixtureVisualization.onFixtureValueUpdate`) and sending a decoded state. That sends more data, splits time-based effects across two windows, and makes the show window's flashes depend on the main window's frame rate. Rejected.

---

## R2. One capability mapping format for all DMX visualizations

**Decision**: Replace the per-type mappings (`MovingHeadVisualizationConfig.channelMapping`, `SpotVisualizationConfig.colorChannels`, `GenericVisualizationConfig.channelMapping`) with one `CapabilityMapping` ([contracts/capability-mapping.ts](./contracts/capability-mapping.ts)). It is a record from `CapabilityKey` (pan, tilt, dimmer, shutter, red, …, colorWheel, goboWheel, prism, zoom, laserPattern, fogOutput, …) to a `CapabilityChannel`:

- `channel`: coarse channel index, or −1.
- `fine`: 16-bit fine channel index, or −1.
- `segments`: a list of DMX ranges, each with a typed meaning (a linear value range, a strobe rate range, a wheel slot, a wheel rotation, open or closed).
- `defaultValue`: used when the channel is unmapped.
- `source`: `"auto"` or `"manual"`.

Multi-cell fixtures add `cells: CellMapping[]`, which holds the per-cell color, dimmer and white channels and is bound to model emitter ids.

**Rationale**: Every OFL capability is "a DMX range with a meaning", so one segment list covers continuous ranges (pan −270…270°), stepped ranges (strobe open / closed / 1–20 Hz) and wheels (slot 3, rotation CW fast…slow). The same editor component (`CapabilityMappingEditor.vue`) and the same auto-mapper serve all types. Per-type configs keep only the non-mapping options (movement, effect style).

**Alternatives considered**:
- A separate config shape per visualization type, like today. That would mean 10 shapes, 10 editors and 10 auto-mappers.
- Storing the OFL definition and mode in the config and evaluating it at runtime. The show window has no fixture library, manual corrections would have nowhere to live, and the project would depend on OFL data that can change.

---

## R3. Automatic mapping from the OFL definition

**Decision**: `capabilities/autoMap.ts` exports `autoMapCapabilities(definition, mode, type, model) → CapabilityMapping`. It is used by `defaultConfig(fixture)` of every DMX visualization, so mapping happens on creation, and by the **Auto-Assign** button. Rules:

1. **Channel list**: resolve the mode's channel list into `ResolvedChannel { index, key, definition, fineOf?, pixelKey? }` (`capabilities/oflResolve.ts`):
   - `null` entries take up an index.
   - Fine channels are found through `fineChannelAliases` and linked to their coarse channel. 24-bit is treated as 16-bit, and the third byte is ignored.
   - Matrix template channels (`templateChannels`, `$pixelKey`) are expanded in the same order as `DmxFixture.channelNames`.
   - `switchChannels` are not supported: the default (first) channel is used.
2. **Capability → key**, by OFL capability type:

   | OFL capability | Key |
   |---|---|
   | `Pan` / `Tilt` | `pan` / `tilt` |
   | `Intensity` | `dimmer` |
   | `ShutterStrobe` | `shutter` |
   | `ColorIntensity` | by color: `red`, `green`, `blue`, `white`, `amber`, `cyan`, `magenta`, `yellow`, `uv`, `lime`, `indigo`, `warmWhite`, `coldWhite` |
   | `ColorTemperature` | `colorTemperature` |
   | `ColorPreset` | `colorMacro` |
   | `WheelSlot` / `WheelRotation` / `WheelSlotRotation` | wheel keys by wheel type (color, gobo, prism) |
   | `Zoom` / `BeamAngle` | `zoom` |
   | `Prism` / `PrismRotation` | `prism` / `prismRotation` |
   | `Fog` / `FogOutput` | `fogOutput` |
   | `Effect` / `Generic` | special-effect keys by name keywords (R14) |

   The first matching channel wins. Matrix channels go into `cells`, never into the fixture-wide keys.
3. **Ranges come from the capability entities**:
   - Angles (`"-270deg"`, `"50%"` of the model's physical limit).
   - Speeds (`"10Hz"`, `"600rpm"`, `"fast"` = 20 Hz or 2 rps, `"slow"` = 1 Hz or 0.1 rps, `"stop"`, `"%"` of these). Wheel rotation in `"%"` uses 1 rps at 100 %.
   - Color temperature (`"3200K"`, `"warm"` = 3000 K, `"cold"`/`"CTB"` = 8000 K, `"CTO"` = 3200 K, `"default"` = 6500 K).
   - Brightness (`"off"` = 0, `"dark"` = 0.2, `"bright"` = 1, `"%"`).
   - Zoom angles fall back to `physical.lens.degreesMinMax`, then to the model default (10–45°).
   - Pan and tilt ranges fall back to the model's `movingParts` limits (feature 002, `defaultChannelRanges`).
4. **Wheels**: `definition.wheels[name].slots` are copied into the config as `WheelDefinition`:
   - Color slots keep their `colors` (two colors = a split color) and their `colorTemperature`.
   - Gobo slots keep an embedded image if there is one (R9).
   - Prism slots keep their `facets`.
   - Open, Closed, Frost and Iris slots keep their type.
   - `WheelSlot` capabilities with `slotNumber`, or with `slotNumberStart`/`End` (continuous scrolling, e.g. 2.5 = halfway between slots 2 and 3), become slot segments.
5. **Unknown or ambiguous** channels stay unmapped. Examples: two `Intensity` channels on a non-matrix fixture, or `Generic` channels without a known keyword. The editor lists them under "Unmapped channels" (US2.2).
6. **Mode tracking**: the config stores `mappedMode` (the mode name) and `mappedChannelCount`. If the fixture's mode or definition changes later, the inspector shows "Fixture mode changed, mapping may be outdated" next to the Auto-Assign button. Nothing is remapped silently, so manual changes are kept (FR-011, US2.3).

**Rationale**: This covers every capability FR-001 lists with data that is already in the bundled OFL export: 98 of the ~700 fixtures define wheels, and 104 define matrices. It runs on creation, so SC-001 needs no manual steps.

**Alternatives considered**: Mapping by channel name (the old `Auto-Assign` matched only capability types for 6 keys). Too weak for wheels and strobe ranges.

**Existing bug fixed on the way**: `DmxFixture.channelNames` drops `null` mode channels, which shifts every later channel index. It has to push a placeholder name (`"(unused)"`) so that channel indices match the DMX layout (`src/stage/fixtures/dmx/dmx.fixture.ts`).

---

## R4. Beam fixtures: one renderer for spot and moving head

**Decision**: A single `BeamRenderer` (`fixtureVisualizations/beam/beam.renderer.ts`) replaces `SpotRenderer` and `MovingHeadRenderer`. Spot/par/wash/profile (type `Spot`) and moving head/scanner (type `Moving Head`) keep their visualization types for the UI and for compatibility, but both are created as `BeamRenderer`. Pan and tilt are only applied when the model has moving parts and the mapping has pan/tilt.

Per frame it:
1. Takes the decoded `BeamState`.
2. Advances the realistic movement (R6).
3. Sets the body's pan and tilt (`FixtureBody.setPanTilt`, feature 002).
4. Writes its light into the view's `SurfaceLighting` (R7).
5. Updates the beam mesh (R8) and the lens emitter.

**Color pipeline** (`colorMath.ts`, all in linear RGB):
1. Additive mix: R, G, B, plus W = (1, 1, 1), A = (1, 0.75, 0), UV = (0.25, 0, 0.6), lime = (0.6, 1, 0), indigo = (0.3, 0, 1), warm white = 3000 K, cold white = 6500 K. With no color channel mapped, the mix is white (FR-003).
2. Subtractive CMY: (1 − C, 1 − M, 1 − Y) multiplies the result.
3. Color wheel: the slot color multiplies the result. While the wheel is between slots (continuous scroll or rotation), the two slot colors are blended by fraction. A split slot uses its two colors, blended 50/50 for surface light, and the beam shows them as two halves.
4. Color temperature or CTO/CTB: multiply by Kelvin → RGB (Tanner Helland approximation), normalized to 6500 K = white.
5. Color macros: the preset color replaces the mix.
6. Intensity = dimmer × shutter/strobe gate × master. Missing channels use FR-003 defaults: dimmer full, shutter open.

**Rationale**: The current spot and moving head renderers duplicate the cone, the light and the color handling. With pan/tilt being "just a node rotation" on the 002 body, the only difference is whether pan/tilt is mapped. One renderer means every capability works on every beam fixture (FR-001 lists the same capabilities for all beam types).

**Alternatives considered**: Extending both renderers separately. That doubles the work for every capability.

---

## R5. Strobe, shutter and photosensitivity

**Decision**: `strobe.ts` turns the shutter segment that is active (open, closed, strobe with a Hz value, pulse, ramp up/down, random/lightning) into a gate value 0..1 per frame, using view time.
- **Strobe**: flash duty 30 %, at least one frame on.
- **Pulse/ramp**: shaped by a sawtooth or triangle.
- **Random**: a seeded hash per period.
- **Photosensitivity limit** (user preference, default on, 3 Hz, FR-061): the effective rate is `min(rate, 3)`. The option "show true rate" turns the limit off.
- **Refresh-rate safety** (edge case): if `rate > fps / 2` (fps measured by the view), the gate alternates every frame instead of being sampled. A 10 Hz strobe never becomes steady (SC-007), and a 60 Hz request on a 60 Hz display flashes at 30 Hz.

**Rationale**: Sampling a square wave at a frequency close to the frame rate aliases into steady light or slow beating. Alternating per frame guarantees visible flashing.

**Alternatives considered**: Real-time accurate flashing based only on time. It aliases, so it was rejected. Separate photosensitivity limits per view: one shared limit protects the user in both windows, so one value is enough.

---

## R6. Realistic movement

**Decision**: `movement.ts` implements a follower for pan and tilt that is limited by velocity and acceleration. Each frame:

```
v ← clamp(v + clamp(desiredV − v, ±a·dt), ±vMax)
x ← x + v·dt
```

where `desiredV = sign(err) · min(vMax, √(2·a·|err|))`. This stops without overshoot and smoothly redirects when the target changes mid-move (edge case).

- **Defaults**: pan 600 °/s, tilt 400 °/s, acceleration 2000 °/s². That gives a 540° pan sweep in ≈ 1.2 s and a 90° move in ≈ 0.4 s.
- **Per-object settings**: `movement: { mode: "realistic" | "instant", panSpeed, tiltSpeed }` (FR-002).
- **Also smoothed**: zoom (≈ 0.3 s full range) and the wheel position (color/gobo wheel slot changes rotate through the slots in between at ≈ 0.25 s per slot). This gives the "transition" of US1.4.

Dimmer, shutter and color mixing stay instant, so SC-004 holds.

**Rationale**: It is the simplest model that both moves at a believable speed and handles retargeting. A plain exponential smoother is not limited by speed: far targets move unrealistically fast and near targets slowly.

**Alternatives considered**: A spring–damper model, which overshoots and needs tuning per fixture. Per-model speed data in the catalog, which is not required. The OFL definition has no speed data either.

---

## R7. Surface lighting: our own light list in the LED-lit material

**Current state**:
- Each spot and moving head owns a `THREE.SpotLight`. `SceneView.updateLightBudget` caps them at 16 by toggling `visible`. Three.js recompiles programs when the light count changes, and every SpotLight adds a uniform block and loop work to *every* material.
- `SpotLight.map` (projected textures such as gobos) only works when `castShadow` is true, and every map and shadow map takes a texture unit. Integrated GPUs often allow only 16 per fragment shader.
- All scene materials are already `createLedLitMaterial` (CustomShaderMaterial on MeshPhysicalMaterial) sharing the uniforms of `LedStripLighting`. Imported GLBs are converted.

**Decision**: Replace `LedStripLighting` with `SurfaceLighting` (`src/visualization/lighting/surfaceLighting.ts`), one per view. It owns all light that fixtures throw onto surfaces, packed into shared uniforms and textures of the LED-lit material:

| Data | Storage |
|---|---|
| Fixture lights | `RGBA32F` data texture, 4 texels per light: position + range; direction + cos(outer); color × intensity + softness; gobo slot, gobo rotation, prism facets/rotation, shadow tile. `uLightCount` uniform. |
| Gobo images | One 2048² RGBA atlas (8 × 8 tiles of 256²): built-in generic patterns plus images from configs (R9). |
| LED strip segments | `RGBA32F` texture, 3 texels per segment: start, end, color + normal (R10). `uSegmentCount` uniform. |
| Shadow depth | Depth atlas (R11), high quality only. |
| Ambient | `uAmbientColor`, plus `uOverflowLight` for lights over budget. |

The fragment chunk (`lighting/shaders/surfaceLighting.frag`, replacing `modifiedStandardMaterial.frag`) loops over `min(uLightCount, MAX_LIGHTS)` lights. `MAX_LIGHTS` is a compile-time define per quality level (R12), so the program only recompiles when the quality changes. For each light it evaluates:
1. A smooth cone (inner/outer from beam angle and softness).
2. Inverse-square falloff with a range cutoff (FR-021: dimmer and wider with distance follows from the cone geometry).
3. A Lambert term.
4. A gobo cookie: project the fragment into the light frame, then sample the atlas tile, rotated, once per prism facet.
5. An optional shadow lookup.

The result goes into `csm_Emissive` like today's strip light. All renderers drop their `THREE.SpotLight`, and `getSurfaceLight()` and `MAX_REAL_SPOTLIGHTS` are removed.

**Light types**: `spot` (beams, pars, LED bars, blinders and strobes as wide spots), `omni` (flames, sparks: flickering point light with a range), and the strip segments.

**Priority (FR-023)**: `lighting/lightPriority.ts` scores each light per frame:

```
score = luminance(color·intensity) · coverage · visibility
```

- `coverage` grows with the beam angle.
- `visibility` is 1 if the lit spot (beam center hit point or light position) is inside the camera frustum, 0.25 otherwise.

Lights are sorted. The top `fullLights` get gobo and shadow, the next `simpleLights` get a cone without gobo or shadow, and the rest are summed into `uOverflowLight` as a soft ambient tint. Their beams, lenses and emitters still render, so no light disappears. A 15 % hysteresis keeps lights from flickering between tiers.

**Rationale**:
- One loop and three textures, whatever the number of fixtures. No recompiles while fixtures change. Gobo projection without shadow maps.
- The texture-unit cost is fixed: 3–4 units on top of the material maps.
- It builds on the material system that 001 and 002 already put on every surface, and it solves FR-021, FR-023 and the gobo part of US3.3 together.

**Alternatives considered**:
- A pool of a fixed number of `THREE.SpotLight`s re-targeted each frame. Gobos need shadow maps (one texture unit each), and the pool size is bounded by texture units. Rejected.
- Deferred or clustered shading. Too much new rendering infrastructure for one maintainer (constitution V).

---

## R8. Beams and haze

**Decision**: The beam keeps the existing volumetric cone shader (`beam.vertex.glsl` / `beam.fragment.glsl`), extended:

- **Haze**: `uHaze` (effective haze, 0..1, R13) scales the beam opacity: `alpha = mix(0.03, 1.0, haze^0.7)`. The noise "fogging" turbulence scales with haze, and its octaves with quality. At 0, beams are nearly invisible but the lens glow and surface light stay (US3.1).
- **Instancing for prism**: an `InstancedBufferGeometry` with a per-instance facet angle. With a prism, `instanceCount` = facets (3–8). Each instance is tilted outward by the prism spread (default 6°) and rotated by the prism rotation. One draw call per fixture.
- **Gobo in the beam**: the fragment computes the beam cross-section coordinate and samples the gobo atlas tile at low mip, so gobo "spokes" show in the haze.
- **Split colors**: half-plane color selection in the beam cross-section.
- **Beam length**: clamped per frame to the first hit of the center ray (R11). That replaces the fixed 100 m cylinder through the floor and stage.
- **Radial segments** depend on quality: 24, 48 or 96.

**Rationale**: The existing shader already looks good. Most new requirements are inputs to it. Instancing keeps prism cheap.

**Alternatives considered**: Ray-marched volumetric fog (screen space). Higher quality, but a lot more GPU cost and complexity. Possible later.

---

## R9. Gobo images and wheel colors in the config

**Decision**: Wheel definitions, including slot colors and gobo images, are copied into the visualization config at mapping time, because the show window has no OFL library (R2). Gobo slot images:
- **Embedded image**: the bundled OFL export embeds gobo SVGs as `resource: { image: { mimeType, data } }`, in 6 fixtures. They are kept as an SVG string. At most 32 KB per image; larger images, or other formats, fall back to a generic pattern.
- **No image**: a **generic pattern** (`generic:<n>`). 12 built-in procedural patterns (dots, star, bars, ring, triangles, …) are drawn with 2D canvas code. The slot number picks the pattern, so neighbouring slots differ (FR-004).

`goboAtlas.ts` rasterizes SVGs through `Image` + `<canvas>` (an SVG data URL, available in both targets and in the show window) into a 256² luminance tile. The tile is reference-counted per view and keyed by a hash of the data.

The generated `open-fixture.ts` types `resource` as `string` (the schema form). The export uses an object, so a small type guard in `oflResolve.ts` handles both. The generated file is not edited.

**Rationale**: This is self-contained project data, works offline in both targets, and the project grows by only a few KB per fixture.

**Alternatives considered**:
- Fetching gobos from the OFL website. Not offline, and CORS issues.
- Storing a reference and resolving it from the library at runtime. The show window has no library.

---

## R10. LED strips: per-pixel display and segment lighting

**Current state**: at most 8 strips (`MAX_INSTANCES`), each resampled to 128 colors and lit as a straight line. The strip body is a parametric profile between `start` and `end`, and the pixels are not visible.

**Decision**:
- **Path**: the `LedStripVisualizationConfig` gets `path: StripPath`, holding object-local points (each with a surface normal), `interpolation: "linear" | "curve"` (centripetal Catmull-Rom), and `closed`. Old `start`/`end` configs are converted on load (data-model.md). `stripPath.ts` builds an arc-length table and returns, for pixel *i* of *N*, the position and normal at `(i + 0.5) / N` of the total length. That gives even spacing even with self-crossing or very short segments (edge cases).
- **Pixels**: one `THREE.Points` per strip with a small custom shader:
  - Round, soft, size in world units (the LED pitch, capped at a minimum of 1.5 px on screen so 2000-pixel strips merge but stay ordered).
  - Additive and not tone-mapped, so bloom makes them glow.
  - Per-pixel color as a normalized `Uint8` attribute updated once per frame from the raw value bytes (no copies through `Color[]`).
  - The pixel count is the fixture's `numLeds` (the value length). There is no resampling (FR-030).
- **Body**: the profile is swept along the path (`ExtrudeGeometry` with `extrudePath` for curves, merged boxes for polylines). The cross-section and material slots come from the strip model (`fixture.ledStrip.profileWidth/Height`, feature 002). The parametric 002 builder remains for previews and the library tile.
- **Surface light (FR-032)**: each strip is split into **segments** of about 0.5 m, each with the average color of its pixels, a start and end, and a normal. Segments of all strips go into `SurfaceLighting` and are evaluated as line lights (closest point plus a 3-tap kernel along the segment, so chases still read on surfaces). The segment budget depends on quality (R12). When there are more segments than the budget, strips farther from the camera use longer segments (LOD: their pixels merge into fewer segments). Every strip keeps contributing, and there is no limit on the number of strips (FR-033).
- **Multi-cell DMX fixtures (FR-034)**: `FixtureBody` gets `setCellColors(colors: Float32Array)`, which writes the per-emitter colors straight into the merged emitter mesh's color attribute through the existing vertex ranges. A single fixture-wide light (the average cell color) goes into `SurfaceLighting`.

**Rationale**: Points are the cheapest way to draw 15 000 pixels (one draw call per strip, one attribute upload). Segments cap the per-fragment cost no matter how many strips exist.

**Alternatives considered**:
- An instanced mesh per pixel. More vertices, and no benefit at these sizes.
- A world-space grid that bins segments for culling. It would allow more segments per fragment, but it is more code. Kept as the fallback if SC-002 is missed (plan, Risks).

---

## R11. Shadows and beam cut-off (high quality)

**Decision**:
- **Shadow atlas** (`lighting/shadowAtlas.ts`): at high quality, the top `shadowLights` (8) lights by priority get a 512² tile in a 2048² depth render target.
  - Each frame, every shadowed light renders the scene's opaque geometry from its perspective into its tile, using a depth-only override material. Beams, emitters, particles and editor helpers are on a layer that is not rendered.
  - Static scenes only re-render tiles whose light moved or changed angle.
  - The surface fragment compares the light-space depth: 2×2 PCF.
- **Beam cut-off**: for shadowed lights, the beam fragment samples the same tile and fades out behind the first occluder (exact per pixel). For all beam lights at every quality, the beam **length** is clamped to the first hit of the center ray. That raycast runs against static scene meshes (shapes, library assets, imported models), at most one per fixture per frame, and is skipped while the fixture and scene are unchanged. A beam then no longer passes through the floor at medium either.

**Rationale**: Shadows from our own lights need our own depth maps. One atlas means one texture unit. The beam reuses the same data for free.

**Alternatives considered**: Three.js built-in shadows. They only work with three's own lights (R7). Shadow volumes: too complex.

---

## R12. Quality levels

**Decision**: `src/visualization/quality.ts` defines a `QualityProfile` per level. Values are starting points that the implementation tunes against SC-002 and SC-003:

| Setting | Low | Medium (default) | High |
|---|---|---|---|
| Render pixel ratio | 0.75 × min(DPR, 1) | min(DPR, 1.5) | min(DPR, 2) |
| MSAA samples (composer target) | 0 | 2 | 4 |
| Bloom | ½ res, 3 mips | ½ res, 5 mips | ½ res, 5 mips |
| Full lights (gobo) / simple lights | 6 / 16 | 16 / 48 | 32 / 96 |
| Shadowed lights | 0 | 0 | 8 |
| Strip light segments | 64 | 192 | 384 |
| Beam radial segments / haze octaves | 24 / 1 | 48 / 2 | 96 / 4 |
| Particles per effect | 128 | 384 | 1024 |
| Laser beams per fixture | 8 | 16 | 32 |

- **Resolution**: bloom and composer targets follow the canvas size times the pixel ratio (FR-051). This fixes today's fixed 4096² bloom.
- **Consistency**: positions, colors and beams are the same at all levels (US6.1). Only light tiers, shadows, resolution and particle counts change.
- **Fallback (FR-055)**: at view start, `quality.ts` checks `EXT_color_buffer_float`, `MAX_TEXTURE_IMAGE_UNITS` and `MAX_TEXTURE_SIZE`. If a shader fails to compile (`renderer.debug.onShaderError`), the affected feature drops one level (shadows off, then gobos off, then fewer lights). The view shows a one-time notice ("Shadows are not supported on this device; using a simpler version").

**Rationale**: These settings are the main cost drivers in this design. Three levels match the spec.

---

## R13. Haze, hazers and ambient light

**Decision**:
- **Haze** (project, FR-020): `scene.environment.haze` (0..1) plus `hazerCoupling: boolean`.
- **Effective haze**: computed per view in `environment.ts` as `clamp(haze + h, 0, 1)`. `h` integrates the outputs of all fog/hazer fixtures in the view: rise τ = 8 s × output, decay τ = 30 s. It is applied only when coupling is on (US5.5). It is visual state, not project data.
- **Ambient (FR-060)**: presets `dark` (hemisphere 0), `house` (warm 2700 K, 0.15) and `daylight` (neutral, 1.2), each with a brightness slider (0–200 %). It is stored in the project per view (`environment.ambient.editor` and `environment.ambient.show`): the spec places it in the scene, and the look of the show should travel with the project.
- **Exposure**: tone-mapping exposure is fixed at today's value. Ambient only drives the hemisphere light and `uAmbientColor`, so fixtures look the same under every preset.
- **Undo**: environment changes are commands with coalescing (`Set haze`).
- **Transport**: they reach views through a new sink method, `environmentChanged`, and protocol message (R15).

**Alternatives considered**:
- Ambient as a user preference. The spec says "the scene MUST offer", and a show designer wants the venue look saved.
- Haze as a per-view preference. FR-020 requires the project.

---

## R14. Special effects

**Decision**: Five new visualization types: `Laser`, `Flame`, `CO2 Jet`, `Cold Spark` and `Fog / Haze`. Strobes and blinders stay on `Generic Fixture`, extended with dimmer, shutter/strobe, cells and a surface light (a wide spot or blinder light). Each new type has its own renderer in `fixtureVisualizations/effects/`, built on a shared `ParticleEmitter`. The effect origin and direction is the model's `beam` description: lasers already have one, and the effect models get one added (data-model.md, catalog delta).

| Type | Visual | Mapped keys (auto-map keywords) |
|---|---|---|
| Laser | Thin additive line beams from the aperture. Patterns: single beam, fan (N beams), cone/tunnel, sheet. Size, rotation, X/Y offset, scan speed. Visibility × haze (like beams). Surface hit dots/lines from CPU raycasts (≤ beams-per-fixture rays, R12) as additive sprites. | `dimmer`/`laserOn` (Intensity, Effect "on"), `red`/`green`/`blue` or `colorMacro` (ColorPreset), `laserPattern` (Effect/Generic "pattern", "figure", "gobo"), `laserSize` ("size", "zoom"), `laserRotation` ("rotat"), `pan`/`tilt` or `laserX`/`laserY` ("x", "y", "move"), `strobe` |
| Flame | Particle flame column (additive, orange→red ramp, rising, noisy). The height follows `height`, otherwise the full model default of 3 m. Flickering `omni` light (2000 K) while on. | `trigger` (Effect "flame"/"fire", Intensity, Generic "fire"), `height` ("height") |
| CO2 Jet | White particle plume, fast up, expands, alpha fades out within ≈ 1.5 s after the trigger ends. No light. | `trigger` (Effect "co2"/"jet", Generic "fire", Intensity) |
| Cold Spark | Spark fountain (point particles with gravity, bright additive, short trails). Height follows `height`. Small warm `omni` light. | `trigger`, `height` |
| Fog / Haze | Large soft sprites with slow drift from the nozzle. Output drives the emission rate and feeds haze coupling (R13). | `fogOutput` (Fog/FogOutput), `fogType` |

- **Particles**: simulated on the CPU (a pool per emitter sized by quality, R12) and drawn as one `THREE.Points` per effect with a custom shader. That is a few thousand particles per frame in total.
- **Unmapped trigger**: if `trigger` is unmapped, the effect is **off** by default. Running pyro is never a safe default. This differs from FR-003, which only defines beam defaults, so it does not conflict. The inspector says "No trigger channel mapped".
- **Category mapping** (feature 002, `categoryMapping.ts`): it picks these types instead of `Generic Fixture` for laser, flame, CO2, spark and smoke/hazer models.

**Rationale**: Each effect reacts to different channels, so a separate type keeps its mapping UI and defaults clear. A shared particle core keeps the code small.

**Alternatives considered**:
- One "Effect" type that switches by model. Mapping UI and defaults would depend on the model, which confuses users.
- GPU-only stateless particles. Trigger on/off history is hard to express without state.

---

## R15. Only render and send what is visible (FR-053, FR-054)

**Current state**:
- The editor viewport keeps rendering when the Programming view is shown, because `App.vue` uses `v-show`.
- The show window is never forgotten: `BroadcastSceneSink.knownWindows` only grows, so values are posted with no window open.
- `LocalSceneSink` applies every value message right away.

**Decision**:
- **`SceneView` active state**: `setActive(active)` stops the `requestAnimationFrame` loop and stops applying values while inactive. Incoming values are only stored as "latest per object". On activation, the view applies all latest values once and resumes.
  - **Editor**: `Viewport.vue` sets active = (viewport has a non-zero size) ∧ (IntersectionObserver reports it visible) ∧ (`document.visibilityState === "visible"`).
  - **Show window**: active = `document.visibilityState === "visible"`.
- **Per-frame application**: `setFixtureValue` and `setFixtureConfig` only mark the object dirty. The render loop applies dirty values once per frame before decoding (FR-054).
- **Sinks report activity**: `SceneSink` gets `readonly active: boolean`. `LocalSceneSink` mirrors its view, and `BroadcastSceneSink` is active while at least one show window is alive and visible.
  - **Protocol v3** adds `bye` (on `pagehide`), `heartbeat` (every 2 s, with `visible`), and a window timeout of 6 s without a heartbeat (crash or kill).
  - `VisualizationServer` only forwards fixture values to active sinks. When a sink becomes active, it receives the full fixture state (`sendStateTo`).
  - Scene changes still go to all sinks, so an inactive view is up to date when it becomes active, but it does not render them.
- **Values on the wire**: fixture values are sent as `Uint8Array` (DMX bytes, or RGB triplets for strips) in protocol v3. Structured cloning is cheaper than nested `number[][]`.

**Rationale**: This meets FR-053 and SC-006 with small changes to existing classes. The heartbeat is needed because `pagehide` does not fire reliably when a process is killed.

**Alternatives considered**: `document.hidden` alone, which misses the in-app tab switch. Pausing the `VisualizationServer` entirely: other code relies on controller values, for example DMX output, so only forwarding to sinks is gated.

---

## R16. User preferences: localStorage, shared across windows

**Decision**: `src/visualization/viewPreferences.ts` (no Pinia, so the show window can use it) reads and writes `localStorage["lms.viewPreferences"]`:

```ts
{
  editor: { quality, showFps },
  show: { quality, showFps },
  photosensitivityLimit: true,
  showTrueStrobeRate: false
}
```

It exposes a small reactive wrapper (a Vue `ref` in both apps) and listens to the `storage` event, so a change in the main window applies to an open show window immediately and the other way round. The show window gets a small gear menu next to its camera menu (quality, FPS overlay).

**Rationale**: Per user and not in the project, as FR-050 and the assumptions require. localStorage already holds the fixture library in both targets (constitution I), so no native adapter change is needed.

**Alternatives considered**: An Electron settings file through the native adapter. That would mean two code paths, and it is not needed.

---

## R17. LED strip drawing tool (FR-031)

**Decision**: A new editor tool, `src/scene/editor/stripPathTool.ts`, driven by `EditorOverlay`.
- **Start**: "Draw path" in the LED strip inspector, or the toolbar button "Draw LED strip". The toolbar button creates an unlinked LED strip visualization first.
- **Drawing**:
  - Each click raycasts the scene surfaces (the same hit logic as asset drop, 002) and appends a point with its surface normal, offset by 5 mm along the normal so the strip sits on the surface.
  - Shift locks the new segment to the dominant world axis.
  - Backspace removes the last point.
  - Enter or a double-click finishes. Esc cancels (the strip keeps its previous path).
  - The ghost segment follows the cursor.
- **Editing** (strip selected and "Edit path" active):
  - Point handles (small spheres on the editor layer) are dragged along surfaces.
  - The midpoint handle of a segment inserts a point. Delete removes the selected point (min 2).
  - Interpolation and closed are toggled in the inspector.
- **Storage**: points are stored in object-local space, so moving the object moves the strip. Every finished edit is one undoable command (`setStripPath`), and drag previews use the existing preview/commit path.

**Rationale**: It reuses the overlay, raycasting and preview infrastructure of 001 and 002.

**Alternatives considered**: Typing coordinates in the inspector. Not usable for walls and curves.

---

## R18. Performance overlay

**Decision**: A small Vue component, `ViewHud.vue` (`src/visualization/`), used by the editor viewport and the show window. It shows:
- FPS (500 ms rolling average from the render loop's frame times) and the frame time in ms.
- At most two notices: the fallback notice (R12) and "Values paused (view hidden)", which only appears in debug builds.

`SceneView` exposes the stats through `onAfterRender`. There is no stats.js dependency.

**Rationale**: FR-052 needs only the frame rate. A few lines of code beat a new dependency (constitution V).

---

## R19. No new dependencies

Everything uses three 0.176 core and examples (`ExtrudeGeometry`, `CatmullRomCurve3`, `InstancedBufferGeometry`, render targets, `EffectComposer`), three-custom-shader-material (already used), Vue/PrimeVue (UI) and browser APIs (`Image`, canvas, `IntersectionObserver`, `BroadcastChannel`, `localStorage`). No Rust, WASM or bridge changes are needed.
