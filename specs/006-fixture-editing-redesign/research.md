# Research: Fixture Editing Redesign

**Feature**: 006-fixture-editing-redesign | **Date**: 2026-11-15

Findings from reading the current code (`src/scene/sceneStore.ts`, `src/scene/model/history.ts`, `src/stage/stage.ts`, `src/visualization/visualizationServer.ts`, the inspector components) and from checking the running app at 1600 × 900. Each entry: decision, rationale, alternatives.

---

## R1 — Making fixture changes undoable together with scene objects

**Current state**: the scene store keeps one history (`SceneHistory`) of `HistoryEntry { before/after: Record<objectId, SceneObject | null>, rootOrder…, environment…, mergeKey }`. Every command goes through `runCommand(label, affected, mutate, recordHistory, mergeKey)`. Fixtures live in the stage store (`stage.fixtures: ExtendedMap<id, BaseFixture>`) and change outside any history (`fixture.setConfig`, `stage.fixtures.set/delete`).

**Decision**: extend `HistoryEntry` with optional `fixturesBefore` / `fixturesAfter: Record<fixtureId, FixtureSnapshot | null>`, by analogy with `environmentBefore/After`. `runCommand` gets an optional `affectedFixtures` list; it snapshots those fixtures before the mutation, collects the ids of fixtures created by the mutation, snapshots all of them afterwards and stores both maps. Undo/redo apply the fixture snapshots **before** the object states, so links are valid when the objects are restored. Merging (mergeKey, `mergeTopTwo`) handles the fixture maps exactly like the object maps (keep the oldest `before`, newest `after`).

**Rationale**: one history, one undo stack, one Ctrl+Z. The pattern already exists for the environment, and every scene command (delete, duplicate, paste, add) already flows through `runCommand`, so fixture side effects are recorded in the same entry without coordinating two stacks.

**Alternatives considered**:
- *Move all fixture data into the scene object* (fixture config as a field of `FixtureVisualizationObject`): one source of truth, but fixtures are used by controllers, programming (profiles, processor, targets), graph nodes, scripting and the timeline through `stage.fixtures`. Rewriting all of these is far outside the feature and against principle V.
- *Separate stage history with a coordinating undo manager*: two stacks that must stay aligned (every scene entry would need a matching stage entry, merges must be mirrored). More code and more failure modes than R1.

## R2 — What a fixture snapshot contains

**Decision**: `FixtureSnapshot = { state: { id, type, name, config }, controllerId: string | null, groups: Array<{ groupId, index }> }`. The output `value` is not part of it (it is runtime output, recomputed every frame). Snapshots are deep copies (structuredClone of the raw config).

**Rationale**: undo of a delete must restore controller assignment and group memberships (spec US1 scenario 7); restoring the same `id` makes clip targets, preset entries and graph node selections resolve again without touching those modules. Group index restores the manual ordering.

**Alternatives considered**: storing controller and group state in the history as whole controller/group lists, rejected because unrelated Controllers/Groups tab edits (not undoable by spec) would then be reverted by an undo.

## R3 — Where fixture primitives live

**Decision**: the stage store gets history-free primitives; the scene store owns the undoable commands.

- Stage store (`src/stage/stage.ts`): `snapshotFixture(id)`, `applyFixtureSnapshot(id, snapshot | null)` (create, update in place, or delete; delete also removes the fixture from its controller and its groups), `createFixtureFromSnapshot` helper used by it.
- Scene store (`src/scene/sceneStore.ts`): `addFixture`, `updateFixture`, `renameObject` (name sync), plus fixture-aware `removeObjects`, `duplicateSelection`, `pasteClipboard`, `addFixtureModel`, and the strip tool's add path.

**Rationale**: the scene store already imports `useStage()` (it reads fixtures for models and link checks), so no new dependency direction is introduced. Keeping the primitives history-free in the stage store lets load/migration use them too.

**Pre-existing bug fixed on the way**: deleting a fixture today (`stage.fixtures.delete`) leaves it in its controller's `controlledFixtures` list; `applyFixtureSnapshot(id, null)` removes it.

## R4 — One name for fixture and object

**Decision**: keep both fields (`fixture.name`, `object.name`) and keep them equal: the scene store's `rename(id, name)` updates the object and, for fixture objects, the fixture in one history entry; creation, duplication and migration set both. On load, the fixture's name wins (spec FR-032).

**Rationale**: the outliner, inspector, 3D labels and all generic scene code read `object.name`; controllers, groups, target pickers, programming and scripting read `fixture.name`. Removing either field touches many modules for no user-visible gain.

**Alternatives considered**: deriving `object.name` from the fixture at read time, rejected because sinks (show window) and saved scenes use the stored name.

## R5 — Deleting fixtures only through the scene

**Decision**: remove `VisualizationServer.removeObjectsOfDeletedFixtures` (the watcher that deleted objects outside the history when a fixture disappeared) and the `Fixtures.vue` delete path. Deleting a fixture object deletes the fixture inside the same `runCommand`. `applyHistoryStates` keeps its link-repair as a safety net, but runs after the fixture snapshots are applied, so restored objects keep their link.

**Rationale**: with deletion flowing from the scene, the watcher would race with undo (it would delete restored objects whose fixture is restored a moment later in the wrong order). The invariant "every fixture has an object" is now kept by the commands and checked by the migration on load.

## R6 — Duplicate, copy & paste of fixture objects

**Decision**:
- The clipboard additionally stores `fixtures: Record<fixtureId, FixtureSnapshot>` for every fixture object in the copied subtrees (the source may be deleted before pasting).
- `cloneSubtrees` maps each source fixture id to a new fixture id; the copy object gets the new id; the mutation creates the new fixtures from the snapshots (new id, same config and controller, no group memberships).
- Names: the trailing number is stripped from the source name and `nextObjectName(scene, base)` gives the next free number ("Spot 1" → "Spot 2"; "Spot" → "Spot 2"). Applied to fixture objects only; other objects keep the existing " copy" suffix.
- A copied controller id that does not exist (another project loaded) leaves the copy unassigned.

**Rationale**: matches spec US1 scenario 5 and the edge cases. Group memberships are not copied: membership is an explicit programming choice, and copying it silently would change existing looks' targets.

## R7 — Fixture property edits

**Decision**: one command `updateFixture(fixtureId, patch: { name?, config?, controllerId? }, label, mergeKey?)` built on `runCommand` with `affectedFixtures: [fixtureId]` and no object changes (except `name`, which also patches the object, R4). All inspector fixture editors call it instead of `fixture.setConfig` / `controller.addFixture`: DMX profile, mode, start channel, LED count, controller, and the attribute defaults editor (`FixtureDefaults.vue`, which currently calls `setConfig`). Merge keys follow the existing scheme (`fixture:${id}:startChannel`, …).

**Rationale**: satisfies FR-010 with the existing merge window (1 s) used by transform and config edits.

## R8 — Visualization when a DMX profile is chosen after creation

**Current state**: a visualization is created after the profile is known, so `defaultConfig(fixture, modelId)` auto-maps the capabilities and the OFL category preselects type and model.

**New flow problem**: fixtures are created first (unpatched), the profile comes later, so the mapping would stay empty.

**Decision**: when `updateFixture` changes a DMX fixture's profile or mode and the fixture object's mapping has never been generated or edited (`mapping.mappedMode === null` and no manual entries), the same command also:
1. switches visualization type and model to the category preselection, **only if** the object still uses the default model of its type and the default type for DMX (i.e. it came from Add → DMX fixture, not from a dropped model the user chose);
2. regenerates the visualization config with `defaultConfig(fixture, modelId)` + `withModelRanges` (auto-mapped).

Everything happens in one history entry. Once a mapping exists, profile or mode changes never touch it (existing "mapping may be outdated" warning).

**Rationale**: keeps today's "pick a profile and it just works" experience, without overriding a model the user picked or a mapping they edited.

## R9 — Migration on load

**Decision**: a pure function `migrateFixtureLinks(sceneState, fixtureStates) → { scene, newFixtures, report }` in `src/scene/model/fixtureLinks.ts`, called in `stage.loadScene` after `sanitizeScene` / legacy conversion and the existing link repair, before `scene.load` (which clears the history, FR-011):
1. Fixtures without an object → object with `modelForType` of the preselection or the type default, inside a group "Unplaced fixtures" at the origin (created only if needed; reused if a group with that name already exists at root).
2. Unlinked LED strip objects → new LED strip fixture, `numLeds = max(1, unlinkedPixelCount(pathLength))` (existing 30/m function).
3. Unlinked other fixture objects → new unpatched DMX fixture.
4. Name mismatch → object takes the fixture's name.
A toast summarises what was created ("3 fixtures were added to the scene…"). A project needing none of this is returned unchanged (FR-033).

**Rationale**: pure function = easy to reason about and to test by hand in the console; running before `scene.load` keeps the migration out of the history. Principle IV would allow skipping it, but the user asked for it and it is small.

## R10 — Collapsible inspector sections

**Decision**: a small in-house `InspectorSection.vue` (header button with chevron + title + optional `#actions` slot, content via `v-show`), not PrimeVue `Accordion`. Open state: `useLocalStorage("lms.inspectorSections", {} as Record<string, boolean>)` from `@vueuse/core` (already a dependency), keyed by section name, default open except "Defaults" and "Channel mapping" details.

**Rationale**: the Channel mapping header needs interactive content (Auto-Assign button, mapped count). PrimeVue `AccordionHeader` renders a `<button>`, and a button inside a button is invalid HTML and breaks keyboard handling. A 40-line component with full control over padding is simpler than overriding Accordion's header/content paddings and borders via `pt` (principle V).

**Alternatives considered**: PrimeVue `Accordion multiple` with `:value` bound to the open keys (checked in the MCP docs, the API exists in 4.x): rejected for the nested-button problem. `Panel toggleable`: heavier chrome (header bar, border, padding per panel), which is what makes the current inspector look cluttered.

## R11 — Compact density for inspector controls

**Finding**: Aura defines component tokens in terms of semantic tokens (`inputtext.paddingX = {form.field.padding.x}`), and PrimeVue emits them as CSS variables at `:root`, e.g. `--p-inputtext-padding-x: var(--p-form-field-padding-x)`. Custom properties inherit their **computed** value, so overriding `--p-form-field-padding-x` on `.inspector` does **not** change `--p-inputtext-padding-x` there (it was already resolved at `:root`). A scoped override would have to redefine every component variable (`--p-inputtext-*`, `--p-select-*`, `--p-button-*`, `--p-inputnumber-*`, …), duplicating theme internals.

**Decision**: every control inside the inspector uses PrimeVue's built-in `size="small"` (InputText, InputNumber, Select, Button, SelectButton; Aura sm tokens: 0.875rem font, 0.375rem / 0.625rem padding) and `fluid`. The shared `PropertyRow` component documents this; a lint-free convention, checked in review and by the manual verification. Spacing uses four CSS custom properties defined once on `.inspector` (`--insp-gap-1..4` = 4/8/12/16 px).

**Rationale**: no theme overrides, consistent with PrimeVue's own sizing, works for overlays (Select panels) too.

## R12 — Property rows and narrow widths

**Decision**: `PropertyRow.vue` = CSS grid `grid-template-columns: minmax(5.5rem, 35%) minmax(0, 1fr)`; the control cell has `min-width: 0` so fluid controls shrink. A container query on `.inspector` (`container-type: inline-size`) switches rows to one column below 280 px (FR-020). Transform fields already use a similar grid and are moved into the same component family (`PropertyRow` with a three-input slot).

**Rationale**: container queries are supported by Electron's Chromium and all current browsers; they react to the splitpane width, which media queries cannot.

## R13 — Minimum inspector width

**Finding**: splitpanes sizes are percentages (`size="20" min-size="12"`); 12 % of a 1280 px window is 154 px.

**Decision**: compute the inspector pane's `min-size` from the editor's measured width so it equals 320 px (`useElementSize` on the editor root, `minSize = 320 / width * 100`, clamped), default size 24 %.

## R14 — Channel mapping layout

**Findings** (24-channel moving head): content width 506 px (640 px with a range table) in a 281 px panel; 29 rows; causes are fixed widths (`.capability-label` 9rem, `.capability-channel` 11rem, `.capability-number` 5.5rem, `.segment-table { margin-left: 9.5rem }`) and a 5-column table inline.

**Decision**:
- Header actions of the section: "18 / 24" badge (mapped channel indices / `channelNames.length`) and Auto-Assign.
- List: mapped capabilities first; unmapped behind a "Show N unmapped" text button (state per component instance, default hidden).
- Entry = `PropertyRow` (label | fluid channel Select) + a source dot (`auto` = muted, `manual` = primary) with tooltip, + one muted summary line built by a pure formatter: "fine: ch 2 · −265°…265°", "3 ranges", "wheel: Color 1". Fine channel, default value and the simple range move into an expandable detail area under the row, laid out as `PropertyRow`s (one control per row, so nothing exceeds the width).
- Range tables and the cell table move into `CapabilityRangesDialog.vue` / `CapabilityCellsDialog.vue` (PrimeVue `Dialog`, plain table with fluid small inputs). Edits emit the same `update:mapping` as today, so undo (via the visualization config merge key) is unchanged.
- Remove `⚠` from the Message text, fix "1 ranges" pluralisation, replace ▸/▾ characters with the chevron icon.

## R15 — Toolbar, outliner and Stage tab bar

- **Toolbar** (`EditorToolbar.vue`): Grid, Axes and Labels toggles move into `DisplayPopover.vue` as a "Scene editor" block of checkboxes; Focus moves into the View menu; buttons that duplicate menu entries become icon-only with tooltips. Target: one row at 1600 px (FR-036). The Add menu gets "DMX fixture" and "LED strip" instead of "Fixture visualization…".
- **Outliner** (`Outliner.vue`): add a header bar matching `AssetLibraryPanel`'s header ("Scene" + Add button that opens the same Add menu); hide the Tree toggler for leaf nodes via `pt` (`nodeToggleButton` gets `visibility: hidden` and zero width when `node.leaf`), and remove the extra node indentation for root leaves.
- **Stage view** (`Stage.vue`): `TabMenu` (deprecated in PrimeVue 4) → `Tabs`/`TabList`/`Tab` with three tabs; Import/Export become text buttons in a separate right-aligned area of the header (`margin-left: auto`), not adjacent to the tabs. `stageViewState.ts` tab constants are renumbered; `selectedFixtureId` is removed.

## R16 — Controllers and Groups integration

- **Groups** (`Groups.vue`): "Add selected fixtures" button next to the member select: adds `scene.selection` objects' fixture ids (DMX only, via `setGroupMembers`).
- **Controllers** (`Controllers.vue`): the comma-joined "Controlled fixtures" text becomes a list of links; clicking one sets the Stage tab to Visualization, selects the fixture object (`scene.select`) and calls the overlay's `focusSelection` (exposed through a small `focusRequest` ref in `stageViewState.ts` that `SceneEditor` watches, because the overlay lives inside the scene editor).
