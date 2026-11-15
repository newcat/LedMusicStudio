# Data Model: Fixture Editing Redesign

**Feature**: 006-fixture-editing-redesign | **Date**: 2026-11-15

No new persisted entities. The project file format (`StageState`) is unchanged; what changes is which states are valid after loading and how changes are recorded. References: research R1–R9.

## Entities

### Fixture (stage store, unchanged shape)

`FixtureState { id, type: "DMX" | "LED Strip", name, value, config }`

- DMX config: `{ definition: OFL | null, mode: OFL mode | null, startChannel: 1–512, defaults?: AttributeValues }`
- LED strip config: `{ numLeds: 1–10000 }`
- Controller assignment: implicit, via `ControllerState.controlledFixtureIds` (at most one controller per fixture).
- Group membership: via `FixtureGroup.fixtureIds` (DMX only).

**Derived values (not stored)**:
- `channelCount` = `channelNames.length` (0 without definition/mode).
- `channelRange` = `[startChannel, startChannel + channelCount − 1]` when `channelCount > 0`.
- `overlaps` = other DMX fixtures on the same controller whose `channelRange` intersects this one.
- `exceedsUniverse` = `channelRange[1] > 512`.
- `isUnpatched` = DMX with `definition === null`.

### Fixture object (scene store, unchanged shape)

`FixtureVisualizationObject { id, kind: "fixtureVisualization", name, fixtureId: string | null, visualizationType, modelId, modelScale, config, transform…, parentId, children, visible, locked }`

`fixtureId` stays nullable in the type (sanitizer input, objects of newer versions), but after loading and after every command the invariants below hold.

### FixtureSnapshot (new, in memory only)

```ts
interface FixtureSnapshot {
  state: { id: string; type: FixtureType; name: string; config: unknown }; // deep copy, no `value`
  controllerId: string | null;
  groups: Array<{ groupId: string; index: number }>;
}
```

Used by history entries (R1/R2) and the clipboard (R6).

### HistoryEntry (extended)

```ts
interface HistoryEntry {
  // existing: label, before, after, rootOrderBefore, rootOrderAfter, environmentBefore?, environmentAfter?, mergeKey?, time?
  fixturesBefore?: Record<string, FixtureSnapshot | null>; // null = fixture did not exist
  fixturesAfter?: Record<string, FixtureSnapshot | null>;  // null = fixture was deleted
}
```

Merge rules (mergeKey and `mergeTopTwo`): for each fixture id keep the older `fixturesBefore` entry and the newer `fixturesAfter` entry, exactly as for objects.

### Clipboard (extended)

```ts
interface Clipboard {
  objects: SceneObject[];
  rootIds: string[];
  fixtures: Record<string, FixtureSnapshot>; // keyed by source fixture id, for every fixture object in `objects`
}
```

### Inspector section state (new, per user, localStorage)

`localStorage["lms.inspectorSections"] = Record<sectionName, boolean>` (true = open). Unknown names default to open, except `defaults` (closed). Not part of the project file.

## Invariants

After loading a project and after every scene command, undo and redo:

1. **I1 – one to one**: every fixture in `stage.fixtures` has exactly one fixture object with `fixtureId === fixture.id`, and every fixture object has a `fixtureId` of an existing fixture. Exception: objects whose kind or visualization type is unknown to this version keep their stored link untouched.
2. **I2 – names**: `object.name === fixture.name` for every linked pair.
3. **I3 – compatibility**: `getVisualizationByType(object.visualizationType).compatibleFixtures` includes `fixture.type`.
4. **I4 – controller**: a fixture is in at most one controller's `controlledFixtures`, and only in controllers compatible with its type. A deleted fixture is in no controller and no group.

## State transitions

```text
                   Add → DMX fixture / drop DMX model
   (none) ───────────────────────────────────────────▶ Unpatched DMX fixture + object
                                                              │ choose profile (+ mode)
                                                              ▼        (R8: preselection + auto-map if never mapped)
                                                       Patched DMX fixture + object
                                                              │ assign controller
                                                              ▼
                                                       Outputting fixture

   (none) ── Add → LED strip / Draw LED strip / drop strip model ──▶ LED strip fixture + object (numLeds from path)

   any ── delete object ──▶ (none)          [undo restores id, config, controller, groups]
   any ── duplicate / paste ──▶ new fixture + object (new id, same config + controller, no groups)
```

## Load-time migration (R9)

| Found in file | Result | Name |
|---|---|---|
| Fixture without object | New object (preselection or type default model) in root group "Unplaced fixtures" at origin | fixture name |
| Unlinked LED strip object | New LED strip fixture, `numLeds = max(1, round(30 × pathLength))` | object name |
| Unlinked object of a DMX visualization type | New unpatched DMX fixture | object name |
| Linked pair with different names | — | fixture name for both |
| Object linked to a missing fixture | Link cleared by the existing repair, then treated as unlinked (row 2/3) | object name |
| Two objects linked to one fixture | Existing repair clears the second link, then row 2/3 | object name |

Runs before `scene.load`, so the history starts after it. Idempotent: a migrated file migrates to itself.

## Validation rules

| Field | Rule | UI behaviour |
|---|---|---|
| name | non-empty after trim | empty input reverts (existing) |
| startChannel | integer 1–512 | clamped by the input; overlap / universe overflow warn only |
| numLeds | integer 1–10000 | clamped |
| controller | `null` or a compatible controller id | select offers only compatible controllers |
| visualizationType | compatible with fixture type (I3) | select filtered |
| modelId | model supports the visualization type | select filtered (existing) |

## Implementation notes

- Objects created by the migration for fixtures without an object are placed 0.5 m apart along X inside "Unplaced fixtures".
- Default visualization of a new unpatched DMX fixture: Generic Fixture (see contracts/fixture-commands.md → Implementation notes).
