# Contract: Fixture Commands

**Feature**: 006-fixture-editing-redesign

Internal API between UI components and the stores. Every command that changes fixtures records exactly one history entry (unless stated) and keeps invariants I1–I4 (data-model.md).

## Stage store (`src/stage/stage.ts`), history-free primitives

| Function | Behaviour |
|---|---|
| `snapshotFixture(id): FixtureSnapshot \| null` | Deep copy of name, type, config; current controller id; group memberships with index. `null` if the fixture does not exist. |
| `applyFixtureSnapshot(id, snapshot \| null): void` | `null`: removes the fixture from its controller and its groups, then deletes it. Snapshot and fixture missing: creates it (`createFixture(type)`, `load` with `resetValue`d value, reactive), assigns controller, inserts into groups at the stored index. Snapshot and fixture present: sets name, `setConfig(config)` (so visualization and controllers are notified), moves it to the snapshot's controller, sets group memberships. |
| `fixtureChannelInfo(id): { range: [number, number] \| null; overlaps: string[]; exceedsUniverse: boolean }` | Derived values from data-model.md; `overlaps` lists fixture names on the same controller. |

The Controllers and Groups tabs keep calling `controller.addFixture/removeFixture`, `setGroupMembers` etc. directly (not undoable, by spec).

## Scene store (`src/scene/sceneStore.ts`), undoable commands

### `runCommand(label, affected, mutate, recordHistory?, mergeKey?, options?: { fixtures?: Iterable<string> })`

`options.fixtures` lists existing fixtures the mutation may change or delete. `mutate` may return `{ objects?: string[]; fixtures?: string[] }` (ids of newly created objects/fixtures) or the existing `string[]` of created objects. Fixture snapshots are captured before and after and stored in `fixturesBefore/After`.

### Undo / redo

`undo()`: apply `fixturesBefore` (via `applyFixtureSnapshot`), then object states, then environment. `redo()`: same with `after`. Link repair in `applyHistoryStates` runs after the fixtures are applied.

### Commands

| Command | Behaviour | History label |
|---|---|---|
| `addFixture(type: FixtureType, options?: { placement?, modelId?, visualizationType?, name?, parentId?, worldTransform?, path? }): string` | Creates fixture (`createFixture(type)`, name = `name` or `nextObjectName(scene, type default name)`) and its object (type: given, else preselection/first compatible; model: given, else `modelForType`); LED strip: `numLeds` from the object's path length (30/m, ≥ 1). Selects the object, returns the object id. | "Add DMX fixture" / "Add LED strip" / `Add ${model name}` |
| `addFixtureModel(modelId, placement?, options?)` | Now delegates to `addFixture` with the model's fixture type (LED strip models → LED strip, else DMX) and first visualization type. | `Add ${model name}` |
| `updateFixture(fixtureId, patch: { name?: string; config?: object; controllerId?: string \| null }, label, mergeKey?)` | Applies the patch through `applyFixtureSnapshot`; `name` also renames the object (I2). DMX profile/mode change on a never-mapped object also updates the object per research R8. | given (e.g. "Change start channel") |
| `rename(objectId, name)` | Existing; for fixture objects also renames the fixture (same entry). | "Rename" |
| `removeObjects(ids, …)` / `deleteSelection()` | Existing; additionally deletes the fixtures of all removed fixture objects (descendants included) in the same entry. | "Delete" |
| `duplicateSelection()` / `pasteClipboard()` | Existing; fixture objects get new fixtures created from snapshots (research R6); names via `nextObjectName`. | "Duplicate" / "Paste" |
| `copySelection()` | Existing; also stores `FixtureSnapshot`s of the copied fixture objects. | — (no entry) |
| `setStripPath(objectId, path, label, options?: { preview?; syncLedCount? })` | Existing; with `syncLedCount` (strip tool finishing a new strip) also sets the fixture's `numLeds` from the path length in the same entry. | existing |
| `discardAddedObject(objectId)` | Existing; also deletes the fixture created with it (no history). | — |

### Removed

- `addFixtureVisualization`, `addUnlinkedFixtureVisualization`, `linkFixture`, `warnAlreadyLinked`, `removeObjectsWithoutHistory` (callers: only the removed watcher and `discardAddedObject`, which uses an internal variant).
- `VisualizationServer.removeObjectsOfDeletedFixtures` and its watcher.
- `stageViewState.selectedFixtureId`, `STAGE_TAB_FIXTURES`.

## Load (`stage.loadScene`)

`migrateFixtureLinks(sceneState, fixtures)` (pure, `src/scene/model/fixtureLinks.ts`) runs after sanitizing and link repair, before `scene.load`. Its new fixtures are created with `applyFixtureSnapshot` (no history). A single info toast reports what was created when anything changed.
