---

description: "Task list for feature 006: Fixture Editing Redesign"
---

# Tasks: Fixture Editing Redesign

**Input**: Design documents from `specs/006-fixture-editing-redesign/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/fixture-commands.md](./contracts/fixture-commands.md), [contracts/inspector-ui.md](./contracts/inspector-ui.md), [quickstart.md](./quickstart.md)

**Tests**: no automated tests (constitution III; not requested in the spec). Each phase ends with manual checks from [quickstart.md](./quickstart.md). Quality gates for every phase: `pnpm lint` and `pnpm build` pass.

**Organization**: tasks are grouped by user story (US1–US6 from spec.md), so each story can be implemented and checked on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: the user story the task belongs to (US1–US6)
- "R#" refers to the decisions in research.md, "I#" to the invariants in data-model.md, "FR-###" to the spec requirements

## Path Conventions

Single Vite project: all paths are relative to the repository root (`src/…`). Work is committed directly to `main` (project convention).

---

## Phase 1: Setup

**Purpose**: confirm a green baseline and keep a pre-feature project file for the migration check.

- [X] T001 Run `pnpm lint` and `pnpm build` on the current `main`, note any existing failures, and confirm `.specify/feature.json` points to `specs/006-fixture-editing-redesign`
- [ ] T002 With the current (pre-feature) app, export a stage file `old-stage.lms` outside the repo containing: one DMX fixture with profile and no visualization, one linked moving head, one LED strip drawn with "Draw LED strip" (unlinked), one dropped "Par can" model (unlinked), one fixture in a group and on a DMX controller (see quickstart.md → Prerequisites)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: fixture snapshots in the scene history (R1–R3, R5) and the inspector building blocks (R10–R12) that every story uses.

**⚠️ CRITICAL**: no user story work can begin until this phase is complete.

### Fixture snapshots and history

- [X] T003 Add the `FixtureSnapshot` type `{ state: { id; type: FixtureType; name; config }; controllerId: string | null; groups: Array<{ groupId; index }> }` (no `value`, deep copies) in `src/stage/fixtures/base.fixture.ts` and export it from `src/stage/fixtures/index.ts`
- [X] T004 Implement history-free primitives in `src/stage/stage.ts` per contracts/fixture-commands.md: `snapshotFixture(id)`, `applyFixtureSnapshot(id, snapshot | null)` (null: remove from its controller via `removeFixture`, remove from all groups, delete from `fixtures`; missing fixture: `createFixture(type)` wrapped in `reactive`, `load` with the snapshot state and `resetValue()`, assign controller, insert into groups at the stored index; existing fixture: set `name`, `setConfig(structuredClone(config))`, move to the snapshot's controller, set group memberships), and `fixtureChannelInfo(id)` returning `{ range: [start, start + channelNames.length − 1] | null, overlaps: string[] (names of DMX fixtures on the same controller with intersecting ranges), exceedsUniverse: range[1] > 512 }`; export all three from the store
- [X] T005 Extend `HistoryEntry` with optional `fixturesBefore` / `fixturesAfter: Record<string, FixtureSnapshot | null>` in `src/scene/model/history.ts`, and update `mergeTopTwo` to keep the older `fixturesBefore` entry and the newer `fixturesAfter` entry per fixture id (same rule as objects)
- [X] T006 Extend `runCommand` in `src/scene/sceneStore.ts` with an `options?: { fixtures?: Iterable<string> }` parameter: snapshot those fixtures before `mutate`; accept `mutate` results of the form `string[]` (created objects, existing behaviour) or `{ objects?: string[]; fixtures?: string[] }`; snapshot all touched fixtures afterwards; store `fixturesBefore/After` only when non-empty; apply the same mergeKey merge rule to the fixture maps (depends on T004, T005)
- [X] T007 Change `undo`/`redo` in `src/scene/sceneStore.ts` to apply `fixturesBefore`/`fixturesAfter` through `stage.applyFixtureSnapshot` before `applyHistoryStates`, so the existing link repair sees restored fixtures (R5) (depends on T006)
- [X] T008 Remove the `removeObjectsOfDeletedFixtures` watcher and method from `src/visualization/visualizationServer.ts` (R5); keep `syncWithScene` unchanged
- [X] T009 Add `FixtureSnapshot`-aware clipboard type `{ objects; rootIds; fixtures: Record<string, FixtureSnapshot> }` to the `Clipboard` interface in `src/scene/sceneStore.ts` (fill it in US1)

### Inspector building blocks

- [X] T010 [P] Create `src/scene/editor/inspector/InspectorSection.vue` per contracts/inspector-ui.md: props `name`, `title`, `defaultOpen = true`; slots default, `actions`, `summary`; header = toggle button (chevron `pi pi-chevron-down/right` + title) with the actions slot outside the button; 32 px header, padding `0 var(--insp-gap-3)`, bottom border `var(--p-content-border-color)`; content via `v-show` with padding `var(--insp-gap-2) var(--insp-gap-3) var(--insp-gap-3)` and row gap `var(--insp-gap-2)`; open state in `useLocalStorage("lms.inspectorSections", {})[name]` (unknown names → `defaultOpen`); expose `open()` and `reveal()` (open + `scrollIntoView({ block: "nearest" })`)
- [X] T011 [P] Create `src/scene/editor/inspector/PropertyRow.vue`: props `label`, optional `hint`, `warning`, `for`; CSS grid `minmax(5.5rem, 35%) minmax(0, 1fr)`, column gap `var(--insp-gap-2)`; label 0.8125rem muted with ellipsis and `title`; `hint` muted 0.75rem and `warning` in `var(--p-orange-400)` below the control; container query `@container inspector (max-width: 280px)` → single column; document the `size="small"` + `fluid` convention in a comment (R11)
- [X] T012 [P] Create `src/scene/editor/inspector/SliderField.vue`: `v-model` number, props `min`, `max`, `step`, `suffix?`, `fractionDigits?`; PrimeVue `Slider` (flex 1) + `InputNumber size="small"` (width 4.5rem) in one row
- [X] T013 Restructure `src/scene/editor/Inspector.vue` as the section container: define `--insp-gap-1..4` (4/8/12/16 px) and `container: inspector / inline-size` on `.inspector`, remove the outer padding/gap in favour of section padding, keep the header (temporarily unchanged), wrap `TransformFields` in `<InspectorSection name="transform" title="Transform">` and each kind's properties component in a section named after the kind ("Shape", "Model", "Asset", "Fixture visualization" for now) (depends on T010)

**Checkpoint**: the app behaves as before (fixture commands are not used yet); the inspector shows collapsible Transform/kind sections; `pnpm lint` and `pnpm build` pass.

---

## Phase 3: User Story 1 – Add, duplicate and remove fixtures in the scene (Priority: P1) 🎯 MVP part 1

**Goal**: fixtures are created and removed only through the scene; add/delete/duplicate/paste are undoable with identity, controller and groups restored (FR-001–FR-009).

**Independent Test**: on an empty stage add fixtures through every entry point, duplicate, delete, undo and redo; Controllers tab, Groups and target pickers always list exactly the fixtures in the scene (quickstart scenarios 2, 4, 6).

- [X] T014 [US1] Implement `addFixture(type, options?)` in `src/scene/sceneStore.ts` per contracts/fixture-commands.md: one `runCommand` that creates the fixture via `stage.applyFixtureSnapshot` (new uuid, name = `options.name` or `nextObjectName(scene, "DMX fixture" | "LED strip")`) and its object via `createFixtureVisualizationObject` (type: given, else first type compatible with the model / fixture; model: given, else `modelForType`; config: `defaultConfig` + `withModelRanges`; position from placement or `applyWorldTransform`; LED strips rotated `[180, 0, 0]` as today); LED strip `numLeds = max(1, unlinkedPixelCount(pathLength))` of the default path; returns `{ objects: [objectId], fixtures: [fixtureId] }`; selects the object (depends on T006)
- [X] T015 [US1] Make `removeObjects` in `src/scene/sceneStore.ts` collect the `fixtureId`s of all removed fixture objects (descendants included) and pass them as `options.fixtures`, deleting them with `stage.applyFixtureSnapshot(id, null)` inside the same mutation (FR-004); keep the aim-target confirmation path in `SceneEditor.vue` unchanged
- [X] T016 [US1] Make `copySelection` store `FixtureSnapshot`s of every fixture object in the copied subtrees in `clipboard.fixtures`, and make `cloneSubtrees` / `duplicateSelection` / `pasteClipboard` in `src/scene/sceneStore.ts` create a new fixture per copied fixture object (new id, same config and controller if that controller exists, no group memberships) instead of clearing `fixtureId`; fixture object copies are named with the trailing number stripped and `nextObjectName(scene, base)` (fixture name = object name); other objects keep the " copy" suffix (R6, FR-005)
- [X] T017 [US1] Make `rename(objectId, name)` in `src/scene/sceneStore.ts` also rename the linked fixture in the same entry (`options.fixtures`), keeping I2 (FR-006)
- [X] T018 [US1] Rewrite `addFixtureModel` in `src/scene/sceneStore.ts` to delegate to `addFixture` with fixture type `LED_STRIP` when the model's visualization types include `LED_STRIP`, otherwise `DMX`, the model's first visualization type, the model's name as base name and the given placement/world transform; update the doc comment in `src/scene/editor/assetDrop.ts`
- [X] T019 [US1] Replace `addUnlinkedFixtureVisualization` with `addFixture(FixtureType.LED_STRIP, …)` in `drawNewStrip` in `src/scene/editor/SceneEditor.vue`; add `syncLedCount` to `setStripPath` in `src/scene/sceneStore.ts` (also updates the linked fixture's `numLeds = max(1, unlinkedPixelCount(length))` in the same entry) and pass it from the "finish new strip" path in `src/scene/editor/stripPathTool.ts`; make `discardAddedObject` also delete the fixture created with the object (no history)
- [X] T020 [US1] Change the Add menu in `src/scene/editor/EditorToolbar.vue` to "DMX fixture" (`mdi mdi-spotlight-beam`) and "LED strip" (`mdi mdi-led-strip-variant`) instead of "Fixture visualization…", extend `AddKind` with `"dmxFixture" | "ledStrip"`, and handle them in `onAdd` in `src/scene/editor/SceneEditor.vue` (`addFixture` at the last surface hit); for "DMX fixture" open `ChooseFixtureDialog` (`src/stage/fixtures/dmx/ChooseFixtureDialog.vue`) bound to the new fixture id, apply the chosen profile with `updateFixture` once US2 exists (until then `fixture.setConfig`), keep the fixture unpatched on cancel, and close the dialog if the fixture disappears (undo)
- [X] T021 [US1] Delete `src/scene/editor/AddFixtureVisualizationDialog.vue` and its usage in `src/scene/editor/SceneEditor.vue`; remove `addFixtureVisualization`, `addUnlinkedFixtureVisualization`, `linkFixture`, `warnAlreadyLinked` and the public `removeObjectsWithoutHistory` from `src/scene/sceneStore.ts` (keep an internal non-recording remove for `discardAddedObject`)
- [X] T022 [US1] Remove the "Linked fixture" select, `fixtureOptions`, `onLinkChanged` and the "Open fixture settings" button from `src/scene/editor/inspector/FixtureVisualizationProperties.vue`; remove the "Open fixture settings" context-menu entry and the `selectedFixtureId` watcher from `src/scene/editor/SceneEditor.vue`
- [X] T023 [US1] Manual check: quickstart scenarios 2 (without profile mapping check), 4 and 6 in the browser build; verify deleting a fixture removes it from the Controllers tab list (pre-existing stale-controller bug fixed by T004)

**Checkpoint**: fixtures can only be created/removed via the scene and all of it is undoable. The Fixtures tab still exists for property editing until US2 replaces it.

---

## Phase 4: User Story 2 – Edit every fixture property in the inspector (Priority: P1) 🎯 MVP part 2

**Goal**: everything formerly in the Fixtures tab is edited in the inspector, undoably; the Fixtures tab is removed (FR-007, FR-008, FR-010, FR-012–FR-017).

**Independent Test**: for one DMX fixture and one LED strip, change every property from the inspector only, check output and 3D view, undo each step (quickstart scenarios 2, 3, 5).

- [X] T024 [US2] Implement `updateFixture(fixtureId, patch: { name?; config?; controllerId?: string | null }, label, mergeKey?)` in `src/scene/sceneStore.ts`: builds the new snapshot from `stage.snapshotFixture` + patch and applies it in one `runCommand` with `options.fixtures: [fixtureId]`; `name` also patches the object name (I2); controller ids not compatible with the fixture type are rejected (I4)
- [X] T025 [US2] Add the R8 rule to `updateFixture` in `src/scene/sceneStore.ts`: when a DMX fixture's `definition` or `mode` changes and its object's `config.mapping` exists with `mappedMode === null` and no entry with `source === "manual"`, also (a) switch `visualizationType`/`modelId`/`modelScale` to `preselectionOf(fixture)` if the object still has `modelId === assetCatalog.defaultModelFor(type).id` and the default DMX type, and (b) regenerate `config` with `getVisualizationByType(type).defaultConfig(fixture, modelId)` + `withModelRanges`, all in the same entry; add the helper `usesDefaultModel(object)` in `src/scene/fixtureModels.ts`
- [X] T026 [P] [US2] Create `src/scene/editor/inspector/FixtureSection.vue` (`<InspectorSection name="fixture" title="Fixture">`) for DMX fixtures per contracts/inspector-ui.md: Profile row (outlined small fluid button with `manufacturer model` or "Choose profile…", opens `ChooseFixtureDialog`, external-link icon button when `oflURL`), Mode select (hidden without profile), Address `InputNumber` with "startChannel: integer 1–512" (`:min="1" :max="512"`), hint from `fixtureChannelInfo.range` ("25–48") and warnings for overlaps ("Overlaps Spot 2") and `exceedsUniverse` ("Does not fit into the universe (ends at 530)"), Controller select (None + controllers whose `compatibleFixtures` include the type); all writes via `updateFixture` with merge keys `fixture:${id}:<field>` (depends on T024)
- [X] T027 [US2] Add the LED strip variant to `src/scene/editor/inspector/FixtureSection.vue`: LEDs `InputNumber` "numLeds: integer 1–10000" with hint "N per metre" (from the strip path length), Controller select; writes via `updateFixture` (depends on T026)
- [X] T028 [US2] Port `src/programming/components/FixtureDefaults.vue` to write through `scene.updateFixture(id, { config: { ...config, defaults } }, "Change default", \`fixture:${id}:defaults\`)` instead of `setConfig`, and lay out its rows with `PropertyRow`; render it inside `<InspectorSection name="defaults" title="Defaults" :default-open="false">` for DMX fixtures with profile and mode
- [X] T029 [US2] Split `src/scene/editor/inspector/FixtureVisualizationProperties.vue` into an "Appearance" section (Type select filtered by fixture type per I3, Model `ModelSelect`, Size row with reset button, all `PropertyRow` + `size="small"`) and the type's settings component in its own section ("Beam & movement" for Spot/Moving Head, "Strip" for LED strip, "Light" for Generic, "Effect" for effect types); render `FixtureSection`, Appearance, settings and Defaults sections in that order from `src/scene/editor/Inspector.vue`
- [X] T030 [US2] Add the validation summary to `src/scene/editor/Inspector.vue`: compact `Message severity="warn" size="small"` listing link-styled buttons for "No DMX profile", "No mode", "No controller", "Channels overlap with …", "Mapping may be outdated"; each calls the target section's `reveal()` (Fixture or Channel mapping) via template refs
- [X] T031 [US2] Replace the header chip in `src/scene/editor/Inspector.vue` with the kind icon (same icon function as `Outliner.vue`, extract to `src/scene/editor/objectIcons.ts`), make the name field fluid, and add the overflow `Menu` (Duplicate → `duplicateSelection`, Delete → the same confirmed delete as `SceneEditor.vue`, Open OFL page for DMX with `oflURL`); expose `deleteSelectionConfirmed` from `SceneEditor.vue` via provide/inject
- [X] T032 [US2] Remove the Fixtures tab: delete `src/stage/components/Fixtures.vue`, `src/stage/components/FixtureSettings.vue`, `src/stage/fixtures/dmx/DmxFixtureSettings.vue`, `src/stage/fixtures/ledStrip/LedStripFixtureSettings.vue` and the `settingsComponent` fields that reference them in `src/stage/fixtures/dmx/dmx.fixture.ts`, `src/stage/fixtures/ledStrip/ledStrip.fixture.ts`, `src/stage/fixtures/base.fixture.ts`; in `src/views/Stage.vue` show only Controllers, Visualization, Groups with Visualization as default; renumber the constants and remove `selectedFixtureId` / `STAGE_TAB_FIXTURES` in `src/views/stageViewState.ts`
- [X] T033 [US2] Switch the profile application in `src/scene/editor/SceneEditor.vue` (T020) to `updateFixture`, so choosing a profile for a new fixture applies the R8 preselection and auto-mapping in one undo step
- [ ] T034 [US2] Manual check: quickstart scenarios 2, 3 and 5 in the browser build, including undo of every field and the validation summary jumping to its section

**Checkpoint (MVP)**: US1 + US2 deliver the requested flow: fixtures are added, edited and removed only in the Visualization tab.

---

## Phase 5: User Story 5 – Existing projects keep working (Priority: P2)

**Goal**: old projects load with every fixture paired with exactly one object (FR-030–FR-033). Scheduled right after the MVP, because without it old projects contain fixtures that can no longer be edited.

**Independent Test**: import `old-stage.lms` from T002 (quickstart scenarios 9, 10).

- [ ] T035 [P] [US5] Create `src/scene/model/fixtureLinks.ts` with the pure function `migrateFixtureLinks(scene: SceneState, fixtures: Array<{ id; type; name; config }>): { scene: SceneState; newFixtures: FixtureSnapshot[]; report: { placed: number; created: number; renamed: number } }` per data-model.md → Load-time migration: fixtures without an object → object (`modelForType` preselection or type default) inside a root group "Unplaced fixtures" at the origin (reuse an existing root group with that name); unlinked LED strip objects → new LED strip fixture with `numLeds = max(1, round(30 × pathLength))` (use `unlinkedPixelCount`); other unlinked fixture objects of known DMX visualization types → new unpatched DMX fixture; names: fixture name wins; objects of unknown kinds/types untouched; idempotent
- [ ] T036 [US5] Call `migrateFixtureLinks` in `loadScene` in `src/stage/stage.ts` after the existing link repair and before `scene.load`, create `newFixtures` via `applyFixtureSnapshot`, and emit one info toast via `emitSceneToast` when the report is non-zero ("N fixtures were placed in 'Unplaced fixtures', M fixtures were created for unlinked visualizations") (depends on T035)
- [ ] T037 [US5] Manual check: import `old-stage.lms` (scenario 9), Ctrl+Z changes nothing, export and re-import (scenario 10) shows no toast and no changes; also open it via File → Open project (`src/globalState.ts` path)

**Checkpoint**: old and new projects load into a consistent one-to-one state.

---

## Phase 6: User Story 3 – A tidy, readable inspector (Priority: P2)

**Goal**: consistent compact layout without horizontal overflow for every object kind (FR-018–FR-024).

**Independent Test**: at minimum and default inspector width select a moving head, an LED strip, a shape and a library asset, open all sections (quickstart scenarios 7, 8).

- [ ] T038 [US3] Set the inspector pane size in `src/scene/editor/SceneEditor.vue` to default 24 % and compute its `min-size` from the editor width so it equals 320 px (`useElementSize(root)`, `minSize = clamp(320 / width × 100, 12, 50)`) (R13)
- [ ] T039 [P] [US3] Lay out `src/scene/editor/inspector/TransformFields.vue` with `PropertyRow` (three small fluid `InputNumber`s in the control cell, `button-layout="stacked"` kept) and keep the "Size is set by the parameters" hint as `PropertyRow hint`
- [ ] T040 [P] [US3] Port `src/scene/editor/inspector/ShapeProperties.vue` and `src/scene/editor/inspector/MaterialField.vue` to `PropertyRow`, `size="small"`, `fluid`
- [ ] T041 [P] [US3] Port `src/scene/editor/inspector/LibraryAssetProperties.vue` and `src/scene/editor/inspector/ParameterFields.vue` to `PropertyRow`, `size="small"`, `fluid`
- [ ] T042 [P] [US3] Port `src/scene/editor/inspector/ImportedModelProperties.vue` and `src/scene/editor/inspector/ModelSelect.vue` (`size="small"`, preview image 24 px) to the new layout
- [ ] T043 [P] [US3] Port `src/visualization/fixtureVisualizations/beam/BeamVisualizationSettings.vue`: remove the `Fieldset` (Channel mapping becomes its own section in US4, until then render the editor directly below), movement `SelectButton size="small"`, pan/tilt speed as two `PropertyRow`s (no side-by-side `.row`), default beam angle and prism spread as `PropertyRow`s, edge softness as `SliderField`
- [ ] T044 [P] [US3] Port `src/visualization/fixtureVisualizations/ledStrip/LedStripVisualizationSettings.vue`: path row with icon-only small Draw/Edit buttons with tooltips, interpolation and closed loop as `PropertyRow`s, pixel size and intensity as `SliderField`, pixel info as hint
- [ ] T045 [P] [US3] Port `src/visualization/fixtureVisualizations/generic/GenericVisualizationSettings.vue` and `src/visualization/fixtureVisualizations/effects/EffectSettings.vue` to `PropertyRow` / `SliderField` with `size="small"`
- [ ] T046 [US3] Remove the remaining `LabelledFormField`/`Divider` usages and ad-hoc paddings inside the inspector tree (`src/scene/editor/Inspector.vue` and `src/scene/editor/inspector/*.vue`), and check with the DevTools that `.inspector` has `scrollWidth === clientWidth` at 320 px for every object kind
- [ ] T047 [US3] Manual check: quickstart scenarios 7 (without the ranges dialog) and 8; section state survives selection change, tab switch and reload

**Checkpoint**: the inspector is consistent and never scrolls sideways (except the channel mapping, fixed in US4).

---

## Phase 7: User Story 4 – Map DMX channels without scrolling through everything (Priority: P2)

**Goal**: compact capability mapping with counts and Auto-Assign in the section header, unmapped rows hidden by default, wide tables in dialogs (FR-025–FR-029).

**Independent Test**: 24-channel moving head and a pixel bar: Auto-Assign, change a channel, add a fine channel, edit ranges and cells in dialogs; no horizontal overflow; correct counts (quickstart scenarios 2, 7).

- [ ] T048 [P] [US4] Create `src/visualization/fixtureVisualizations/capabilitySummary.ts` with pure functions `mappedChannelCount(mapping, channelCount)` (distinct mapped coarse + fine channel indices) and `capabilitySummary(entry, keyInfo, wheels)` returning the muted summary line ("fine: ch 2 · −265°…265°", "3 ranges", "wheel: Color 1", "default 0.5", correct singular/plural)
- [ ] T049 [P] [US4] Create `src/visualization/fixtureVisualizations/CapabilityRangesDialog.vue`: PrimeVue `Dialog` (header "<Capability> – ranges", width `min(48rem, 90vw)`), table From/To (`InputNumber` "0–255"), Kind (Select of segment kinds), Values (numeric fields per kind, shutter effect / laser pattern selects, colours + temperature), remove button, "Add range"; emits the edited entry immediately (logic moved from `CapabilityMappingEditor.vue`: `newSegment`, `addSegment`, `removeSegment`, `setSegmentKind`, `setSegmentValue`, `setColors`)
- [ ] T050 [P] [US4] Create `src/visualization/fixtureVisualizations/CapabilityCellsDialog.vue`: Dialog "Pixel cells", table Emitter, Pixel, R, G, B, W, A, UV, Dimmer with small channel Selects; emits `update:cells`; shows the cell-spread hint
- [ ] T051 [US4] Rewrite the template and styles of `src/visualization/fixtureVisualizations/CapabilityMappingEditor.vue` per contracts/inspector-ui.md → Channel mapping section: outdated warning without emoji; group labels 0.75rem uppercase muted; mapped capabilities as `PropertyRow` (fluid small channel Select + 6 px source dot with tooltip "Auto-assigned"/"Edited manually") with `capabilitySummary` as hint and an expand chevron revealing detail `PropertyRow`s (Fine, Default, Range from/to, Wheel + wheel preview, "Edit ranges… (N)"); "Show N unmapped"/"Hide unmapped" text button; "Edit cells… (N)"; muted unmapped-channels note; remove all fixed widths (`.capability-label`, `.capability-channel`, `.capability-number`, `.segment-table` margin) (depends on T048–T050)
- [ ] T052 [US4] Move Auto-Assign and the `mapped/total` `Tag` into the section header: render the mapping editor inside `<InspectorSection name="channelMapping" title="Channel mapping">` from `src/scene/editor/Inspector.vue` (or the settings components) with an `#actions` slot, exposing `onAutoAssign` and the count from `CapabilityMappingEditor.vue` via `defineExpose` or a small composable; remove the mapping editor from `BeamVisualizationSettings.vue`, `GenericVisualizationSettings.vue` and `EffectSettings.vue` so it appears once, after the type's settings section
- [ ] T053 [US4] Manual check: quickstart scenario 7 including the ranges dialog, counts after Auto-Assign and manual edits, undo of a dialog edit, pixel bar cells dialog; inspector content height for the 24-channel moving head with all sections open ≤ 2,000 px (SC-004)

**Checkpoint**: the whole inspector fits its width; the mapping is readable at a glance.

---

## Phase 8: User Story 6 – Controllers, Groups and the editor chrome fit the new flow (Priority: P3)

**Goal**: toolbar on one row, outliner header, Stage tab bar cleanup, Controllers/Groups integration (FR-034–FR-038).

**Independent Test**: quickstart scenarios 1, 11, 12 at 1600 × 900.

- [ ] T054 [P] [US6] Move the Grid, Axes and Labels toggles from `src/scene/editor/EditorToolbar.vue` into a "Scene editor" block of checkboxes in `src/scene/editor/DisplayPopover.vue` (bound to `store.scene.settings` like today), move Focus into the View menu, make Draw strip / Undo / Redo icon-only with tooltips; verify one row at 1600 px
- [ ] T055 [P] [US6] Add a header to `src/scene/editor/Outliner.vue` matching `src/scene/editor/library/AssetLibraryPanel.vue` (title "Scene", right-aligned `+` button emitting `add-menu` that `SceneEditor.vue` connects to the toolbar's Add menu items), hide the Tree toggler and its space for leaf nodes via `pt`, row height 28 px, padding `0 var(--insp-gap-2)` equivalent (8 px)
- [ ] T056 [P] [US6] Replace `TabMenu` with PrimeVue `Tabs`/`TabList`/`Tab` in `src/views/Stage.vue` (three tabs, `v-model:value` bound to `activeStageTab`), and move Import/Export into a right-aligned area (`margin-left: auto`) as `Button text size="small"` with tooltips "Import stage…" / "Export stage…"
- [ ] T057 [US6] Add `focusRequest = ref<string | null>(null)` to `src/views/stageViewState.ts`; watch it in `src/scene/editor/SceneEditor.vue` to select the object (`store.select`) and call `overlay.focusSelection()`, then reset it; in `src/stage/components/Controllers.vue` render controlled fixtures as text buttons that set `activeStageTab` to Visualization and `focusRequest` to the fixture's object id (`scene.findObjectByFixture`)
- [ ] T058 [US6] Add "Add selected fixtures" (`Button outlined size="small"`) next to the Members select in `src/stage/components/Groups.vue`: adds the DMX fixture ids of `scene.selection` objects not yet in the group via `stage.setGroupMembers`; disabled with no such selection; tooltip "Adds N fixtures"
- [ ] T059 [US6] Manual check: quickstart scenarios 1, 11 and 12

**Checkpoint**: all user stories complete.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T060 Search the codebase for leftovers and remove them: `selectedFixtureId`, `STAGE_TAB_FIXTURES`, `addFixtureVisualization`, `linkFixture`, `addUnlinkedFixtureVisualization`, `settingsComponent` on fixtures, `LabelledInputText` (delete `src/components/LabelledInputText.vue` if unused), stale comments mentioning "unlinked" or "Open fixture settings" in `src/scene/` and `src/visualization/`
- [ ] T061 [P] Update `specs/006-fixture-editing-redesign/contracts/*.md` and `data-model.md` where the implementation deviated (names, file locations)
- [ ] T062 Run `pnpm lint` and `pnpm build`; fix all findings
- [ ] T063 Run the full manual verification from spec.md (steps 1–8) in the browser build (`pnpm dev`) and the desktop build (`pnpm electron:dev`); record results and any deviations in the spec's Status line

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup; blocks all stories
- **US1 (Phase 3)**: depends on Phase 2
- **US2 (Phase 4)**: depends on Phase 2 and US1 (T020 profile flow, T021/T022 removals); completes the MVP
- **US5 (Phase 5)**: depends on Phase 2 and US1 (uses `applyFixtureSnapshot`, no UI); can run in parallel with US2
- **US3 (Phase 6)**: depends on Phase 2; best after US2 (FixtureSection/Appearance split exists); independent of US5
- **US4 (Phase 7)**: depends on US3 T043 (Fieldset removed) and Phase 2
- **US6 (Phase 8)**: depends on US1/US2 for the Add menu items and tab constants; otherwise independent
- **Polish (Phase 9)**: after all desired stories

### Story completion order

```text
Setup → Foundational → US1 → US2 (MVP) ─┬─→ US5
                                        ├─→ US3 → US4
                                        └─→ US6
```

### Within each story

- Store commands before UI that calls them (T014–T019 before T020; T024–T025 before T026–T033)
- New components before the files that use them (T048–T050 before T051)

### Parallel Opportunities

- Phase 2: T010, T011, T012 in parallel (new files); T008 in parallel with T003–T007
- US2: T026 in parallel with T028 (different files) after T024
- US5: T035 in parallel with any US2 UI task
- US3: T039–T045 all in parallel (one file group each)
- US4: T048, T049, T050 in parallel
- US6: T054, T055, T056 in parallel

---

## Parallel Example: User Story 3

```text
Task: "T039 Lay out TransformFields.vue with PropertyRow"
Task: "T040 Port ShapeProperties.vue and MaterialField.vue"
Task: "T041 Port LibraryAssetProperties.vue and ParameterFields.vue"
Task: "T043 Port BeamVisualizationSettings.vue"
Task: "T044 Port LedStripVisualizationSettings.vue"
```

## Parallel Example: User Story 4

```text
Task: "T048 capabilitySummary.ts"
Task: "T049 CapabilityRangesDialog.vue"
Task: "T050 CapabilityCellsDialog.vue"
```

---

## Implementation Strategy

### MVP first (US1 + US2)

1. Phase 1 Setup, Phase 2 Foundational
2. Phase 3 US1 → check (Fixtures tab still used for properties)
3. Phase 4 US2 → check; the requested flow is complete
4. **STOP and validate** with quickstart scenarios 2–6; commit to `main`

### Incremental delivery

1. MVP (US1 + US2)
2. US5 migration (so old projects keep working) → commit
3. US3 tidy inspector → commit
4. US4 channel mapping → commit
5. US6 chrome → commit
6. Polish and full manual verification in both targets

---

## Notes

- [P] tasks touch different files and have no dependency on an unfinished task
- Commit after each phase checkpoint (directly to `main`), with `pnpm lint` and `pnpm build` green
- The file format does not change; old files keep loading (no breaking-change note needed)
- Avoid editing `src/scene/sceneStore.ts` from two tasks at the same time: its tasks are intentionally not marked [P]
