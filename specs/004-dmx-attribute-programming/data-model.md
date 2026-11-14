# Data Model: Attribute-Based DMX Fixture Programming

**Feature**: [spec.md](./spec.md) | **Research**: [research.md](./research.md) | **Contracts**: [contracts/](./contracts/)

Units: degrees, Hz, rps, Kelvin. Timeline positions are in units (24 per beat). Values are 0–1 unless noted. Persisted fields are marked **(saved)**. Everything else is derived at runtime.

---

## 1. Attributes and fixture profiles (runtime)

### AttributeKey
`dimmer | shutter | pan | tilt | panTiltSpeed | color | colorTemperature | colorWheel | colorMacro | goboWheel | goboRotation | prism | prismRotation | zoom | focus` (R1).

### AttributeValue (by key)
| Key | Type | Range / validation |
|---|---|---|
| dimmer, panTiltSpeed, zoom, focus | number | clamped 0–1 |
| pan, tilt | number | degrees, clamped to the fixture's range; 0–1 if the profile marks pan/tilt as `normalized` |
| goboRotation, prismRotation | number | rps, clamped to the fixture's range |
| colorTemperature | number | K, clamped to the fixture's range |
| color | `[r, g, b]` | sRGB, each 0–1 |
| colorWheel, goboWheel, colorMacro | integer | 1…slot count; invalid slot → attribute ignored for that fixture |
| prism | integer | 0 = off, 1…slot count |
| shutter | `{ mode: "open" \| "closed" \| "strobe"; rate: number }` | rate in Hz, ≥ 0; only used for `strobe` |

Kinds: **continuous** = dimmer, pan, tilt, panTiltSpeed, color, colorTemperature, goboRotation, prismRotation, zoom, focus. **Discrete** = shutter, colorWheel, colorMacro, goboWheel, prism.

### Built-in defaults (FR-012)
dimmer 0 · shutter open · pan 0 · tilt 0 · panTiltSpeed 1 · color white `[1,1,1]` · colorTemperature: the fixture's range center · colorWheel: the "open" slot, or 1 · colorMacro: none (channel default) · goboWheel: the "open" slot, or 1 · goboRotation 0 · prism 0 · prismRotation 0 · zoom 0.5 · focus 0.5.

### FixtureProfile (runtime, cached per fixture, R3)
- `fixtureId`
- `channelCount`
- `supported: Set<AttributeKey>` (attributes whose keys are mapped)
- `panTiltNormalized: boolean`
- `ranges` (per continuous attribute: min, max in its unit)
- `slots` (per discrete attribute: list of `{ number, name, kind }`, from the mapping's wheels or the color macro segments)
- `channelDefaults: Uint8Array` (OFL defaults for all channels)
- `writers` (per attribute: channel indices it writes; used for the raw-override rule)
- encoder tables (sorted segments, wheel OKLab colors)

Invalidated when the mapping (R2 resolution), mode, definition or start channel changes.

---

## 2. Per-fixture defaults **(saved)**

`DmxFixtureConfiguration.defaults: Partial<Record<AttributeKey, AttributeValue>>`, default `{}`.
- Validation on load: drop keys with invalid values. Keys the fixture does not support are kept, so a mode change back restores them, but are ignored.

---

## 3. Groups **(saved)**

```
FixtureGroup {
  id: string (uuid)
  name: string (non-empty, unique within the stage; duplicates get " (2)" on create)
  fixtureIds: string[]   // DMX fixtures only, no duplicates; manual order
  ordering: "manual" | "leftToRight" | "rightToLeft" | "frontToBack" | "backToFront"
          | "bottomToTop" | "topToBottom" | "distanceFromCenter"
}
```
- Stored in `StageState.groups: FixtureGroup[]` (default `[]`).
- **Resolved order** (runtime): see research R6. Fixtures without a scene object come last, in manual order.
- Fixture deleted → removed from every group. Group may become empty (allowed, warning on use).

### Target **(saved, embedded)**
`{ kind: "group"; id: string } | { kind: "fixture"; id: string }`
- **ResolvedTarget** (runtime): an ordered list of `{ fixtureId, index, normalizedIndex, position: Vec3 | null }` plus `warnings: string[]`. "Unresolved" means the group or fixture is missing (no output, warning).

---

## 4. Timeline additions **(saved)**

| Entity | New field | Type | Default |
|---|---|---|---|
| `ITrackState` | `defaultTarget` | `Target \| null` | `null` |
| `IItemState` | `target` | `Target \| null` | `null`; set from the track's `defaultTarget` on creation |
| `IItemState` | `fadeIn`, `fadeOut` | number (units, ≥ 0) | `0`; only used by Look and Effect items; clamped at runtime to `length / 2` each |

**Priority** (runtime, R4): `(trackIndex, item.start)`, compared lexicographically; the higher one wins. `trackIndex` is the position in `timeline.tracks` (the last track, shown lowest, is the highest).

---

## 5. Contributions (runtime, per frame)

```
Contribution {
  fixtureId: string
  priority: [trackIndex, start]
  attributes: Partial<Record<AttributeKey, { value: AttributeValue; mode: "absolute" | "relative"; weight: number }>>
  raw: Map<channelIndex, 0..255> | null   // raw DMX output node
}
```

Sources:

| Source | Produces |
|---|---|
| Graph item, Attribute Output node | absolute values, weight 1 |
| Graph item, raw DMX output node | `raw` for all channels of the fixture (same as today) |
| Look item | absolute values; weight = fade weight per fixture (fan timing) |
| Effect item | relative offsets or absolute values; the fade scales the weight (absolute) or size (relative) |

**Fold** per fixture (R4): defaults → contributions in priority order → encode → raw-override per channel → `fixture.setValue`.

Merge state per attribute during the fold: `{ value, writerPriority | null }`.

---

## 6. Look **(saved, library item `LOOK`)**

```
LookState {
  id, name
  values: Partial<Record<AttributeKey, LookValue>>
  fanTiming: number            // 0..1, default 0
  perFixture: Record<fixtureId, Partial<Record<AttributeKey, AttributeValue>>>   // only from "baking" a deleted preset; default {}
}

LookValue =
  | { kind: "single"; value: AttributeValue }
  | { kind: "fan"; from: AttributeValue; to: AttributeValue; mirror: boolean }   // continuous attributes only
  | { kind: "preset"; presetId: string }
  | { kind: "aim"; aimTargetId: string }        // only for key "pan" (sets pan and tilt together; "tilt" must be absent)
```

**Value resolution** for a fixture at group position `i` of `n` (in this order):
1. `perFixture[fixtureId][key]` if present
2. `preset`: the preset's per-fixture value, else its common value, else unset (US7.3)
3. `fan`: `lerp(from, to, p)` (R9)
4. `single`: the value
5. `aim`: pan/tilt from inverse kinematics (R11); unreachable → clamp and warning; no scene position → unset and warning

Validation: an `aim` value or a position preset with an aim target removes `tilt` from the look's own values (the editor enforces this). A dangling `presetId` (preset deleted outside the bake flow) → the attribute is unset and a warning is shown.

---

## 7. Effect **(saved, library item `EFFECT`)**

```
EffectState {
  id, name
  attribute: "dimmer" | "pan" | "tilt" | "panTilt" | "zoom" | "focus" | "color"
  shape: "sine" | "triangle" | "sawUp" | "sawDown" | "square" | "circle" | "figure8"   // circle/figure8 only with panTilt
  mode: "relative" | "absolute"          // color: always absolute
  size: number | [number, number]        // panTilt: [panDeg, tiltDeg]; dimmer/zoom/focus: 0..1 swing; pan/tilt: degrees
  base: number | [number, number]        // absolute mode only
  colors: [rgb, rgb]                     // color only
  rateBeats: number                      // > 0, beats per cycle, default 1
  spread: number                         // degrees, 0..720, default 360
  wings: integer ≥ 1, blocks: integer ≥ 1, interleave: integer ≥ 1   // defaults 1
  direction: "forward" | "backward"
}
```
Phase and value formulas: research R8. Fixtures that do not support the attribute are skipped.

---

## 8. Preset **(saved, library item `PRESET`)**

```
PresetState {
  id, name
  presetKind: "position" | "color" | "beam"
  common: Partial<Record<AttributeKey, AttributeValue>>
  perFixture: Record<fixtureId, Partial<Record<AttributeKey, AttributeValue>>>
  aimTargetId: string | null             // position only; if set, common/perFixture pan/tilt are ignored
}
```
Allowed keys per kind: research R10. Uses (runtime) = looks whose values reference `id`. Deleting a preset that is in use → confirm, then bake into those looks (R10).

---

## 9. Aim target **(saved, scene object)**

`AimTargetObject = SceneObjectBase<"aimTarget">`: name, position (world via parent chain), rotation and scale ignored. Added to `KNOWN_KINDS`. Sanitize: the standard base-field rules of feature 001. Rendered as a crosshair gizmo in the editor viewport only.

---

## 10. Graph additions (runtime + saved node state)

- `ICalculationData.fixture?: { index: number; normalizedIndex: number; position: Vec3 | null; groupSize: number; fixtureId: string }`
- **Attribute Output node** (saved via Baklava node state):
  - `target`: `"clip" | Target`
  - per-attribute input value plus `enabled` flag. Outputs `{ attributeTargets: string[], attributes }`, read by the processor instead of `fixtureId` / `data`.
- **Fixture Input node**: no state.
- **Stateful nodes** keep `Map<fixtureIndex, State>` (R7).

---

## 11. State transitions

- **Item lifecycle**: created → inherits target → active while `start ≤ position ≤ end` → contributes with its fade weight → inactive (its attributes are released immediately, FR-011).
- **Preset**: created → referenced by looks → edited (all uses update) → deleted (confirm → baked into looks).
- **Group**: created → members/order edited → fixture removed (member dropped) → deleted (referencing targets become unresolved).
- **Aim target**: placed → moved (inverse kinematics recomputed each frame) → deleted (aimed fixtures unset with a warning).
