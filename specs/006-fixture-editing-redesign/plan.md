# Implementation Plan: Fixture Editing Redesign

**Branch**: `main` (no feature branch, see project convention) | **Date**: 2026-11-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/006-fixture-editing-redesign/spec.md`

## Summary

Fixtures become first-class scene objects: the scene editor (Visualization tab) is the only place to add, edit and remove them, and the Fixtures tab goes away. Technically, fixtures stay in the stage store (controllers, programming, graph and timeline keep reading `stage.fixtures`), but every change to them now goes through scene store commands that record fixture snapshots in the existing scene history next to object states (research R1–R3). Deleting, duplicating and pasting fixture objects create or delete the fixtures in the same history entry; names are kept in sync; a pure migration on load gives every fixture an object and every object a fixture (R9). The inspector is rebuilt from three small components (`InspectorSection`, `PropertyRow`, `SliderField`) with PrimeVue's built-in small size, and the capability mapping editor is reorganised so it never exceeds the inspector width, with range and cell tables in dialogs (R10–R14). Toolbar, outliner, Stage tab bar, Controllers and Groups get the small integration changes from the spec (R15–R16).

## Technical Context

**Language/Version**: TypeScript 5 (strict), Vue 3.5 Composition API (`<script setup>`)

**Primary Dependencies**: PrimeVue 4.3.4 (Aura preset via `@primeuix/themes`), Pinia, `@vueuse/core` 13, splitpanes, Three.js (unchanged), Tailwind 4 (utility classes used sparingly)

**Storage**: project file `StageState` (JSON) — shape unchanged; inspector section state in `localStorage["lms.inspectorSections"]`

**Testing**: no automated tests required (constitution III); manual verification per spec, quality gates `pnpm lint` + `pnpm build`

**Target Platform**: browser build (GitHub Pages) and Electron desktop build

**Project Type**: single-page desktop/web application (Vue SPA + Electron shell)

**Performance Goals**: inspector re-render on selection change and field edits without visible lag (< 1 frame budget for typing); undo/redo of fixture entries as fast as today's object entries; migration on load linear in the number of objects (projects have tens to a few hundred fixtures)

**Constraints**: inspector usable at 320 px width without horizontal scrolling; toolbar on one row at 1600 px; no new runtime dependency; fixture ids must survive delete + undo (clip/group/preset references)

**Scale/Scope**: ~25 files touched (store, history, migration, ~12 Vue components, 3 new components, 2 new dialogs), 2 components deleted (`Fixtures.vue`, `FixtureSettings.vue`) plus `AddFixtureVisualizationDialog.vue`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. Two targets, one codebase | Pure UI/store work; no native APIs. `localStorage` is used through `useLocalStorage` (available in Electron's renderer and browsers; failures fall back to in-memory, as in `viewPreferences.ts`). Manual verification covers both targets. | ✅ |
| II. Typed boundaries & quality gates | No bridge/WASM protocol changes, no generated files touched. New types (`FixtureSnapshot`, history fields, clipboard field) are fully typed; `pnpm lint` and `pnpm build` are part of the quickstart. | ✅ |
| III. Manual verification | Spec contains a concrete procedure (8 steps, both targets); quickstart lists smoke scenarios. | ✅ |
| IV. Free iteration before 1.0 | File format unchanged; old files load and are migrated (R9). No breaking change to announce. | ✅ |
| V. Simplicity first | Reuses the existing history mechanism (one extra optional pair of maps, like the environment) instead of a second history; in-house 40-line section component instead of fighting Accordion; built-in `size="small"` instead of theme overrides; no new dependency. | ✅ |

**Post-design re-check (after Phase 1)**: the contracts add no new dependency, no new store, no new persisted format; the only structural addition is the optional fixture maps in `HistoryEntry` and the clipboard. All gates still pass. No Complexity Tracking entries needed.

## Project Structure

### Documentation (this feature)

```text
specs/006-fixture-editing-redesign/
├── plan.md              # this file
├── research.md          # Phase 0: R1–R16
├── data-model.md        # Phase 1: entities, invariants, migration table
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   ├── fixture-commands.md   # store API (stage primitives, scene commands, load)
│   └── inspector-ui.md       # inspector, editor chrome, Stage/Controllers/Groups UI
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
src/
├── scene/
│   ├── sceneStore.ts                 # runCommand fixture maps; addFixture, updateFixture; fixture-aware
│   │                                 #   remove/duplicate/copy/paste/rename/addFixtureModel/setStripPath;
│   │                                 #   undo/redo apply fixtures first; removed link/unlinked commands
│   ├── model/
│   │   ├── history.ts                # HistoryEntry.fixturesBefore/After, merge rules
│   │   ├── fixtureLinks.ts           # NEW: migrateFixtureLinks (pure), duplicate-name helper
│   │   └── types.ts                  # FixtureSnapshot type (or in stage), clipboard type
│   ├── fixtureModels.ts              # helper: "object still uses defaults" check for R8
│   └── editor/
│       ├── SceneEditor.vue           # Add kinds, pane min width, focus request, context menu cleanup
│       ├── EditorToolbar.vue         # one-row layout, new Add menu
│       ├── DisplayPopover.vue        # Grid/Axes/Labels section
│       ├── Outliner.vue              # header, leaf indent
│       ├── Inspector.vue             # header + overflow menu, validation summary, sections
│       ├── AddFixtureVisualizationDialog.vue   # DELETED
│       ├── assetDrop.ts              # fixture models → addFixture
│       ├── stripPathTool.ts          # syncLedCount on new strips
│       └── inspector/
│           ├── InspectorSection.vue  # NEW
│           ├── PropertyRow.vue       # NEW
│           ├── SliderField.vue       # NEW
│           ├── FixtureSection.vue    # NEW: DMX/LED fixture properties (replaces stage FixtureSettings)
│           ├── FixtureVisualizationProperties.vue  # Appearance + type settings sections, link select removed
│           ├── TransformFields.vue   # PropertyRow layout
│           ├── ShapeProperties.vue, ImportedModelProperties.vue, LibraryAssetProperties.vue,
│           │   ParameterFields.vue, MaterialField.vue, ModelSelect.vue   # PropertyRow + size="small"
├── stage/
│   ├── stage.ts                      # snapshotFixture, applyFixtureSnapshot, fixtureChannelInfo; migration call
│   ├── components/
│   │   ├── Fixtures.vue              # DELETED
│   │   ├── FixtureSettings.vue       # DELETED
│   │   ├── Controllers.vue           # fixture links → scene selection
│   │   └── Groups.vue                # "Add selected fixtures"
│   └── fixtures/
│       ├── dmx/DmxFixtureSettings.vue          # DELETED or folded into FixtureSection
│       ├── dmx/ChooseFixtureDialog.vue         # reused unchanged
│       └── ledStrip/LedStripFixtureSettings.vue # DELETED or folded into FixtureSection
├── programming/components/FixtureDefaults.vue   # writes via scene.updateFixture; PropertyRow layout
├── visualization/
│   ├── visualizationServer.ts        # remove removeObjectsOfDeletedFixtures watcher
│   └── fixtureVisualizations/
│       ├── CapabilityMappingEditor.vue          # compact rows, filter, details
│       ├── CapabilityRangesDialog.vue           # NEW
│       ├── CapabilityCellsDialog.vue            # NEW
│       ├── capabilitySummary.ts                 # NEW: pure summary-line formatter
│       ├── beam/BeamVisualizationSettings.vue   # sections, PropertyRow, SliderField
│       ├── ledStrip/LedStripVisualizationSettings.vue
│       ├── generic/GenericVisualizationSettings.vue
│       └── effects/EffectSettings.vue
└── views/
    ├── Stage.vue                     # Tabs, 3 tabs, Import/Export area
    └── stageViewState.ts             # tab constants, focusRequest; selectedFixtureId removed
```

**Structure Decision**: single Vue application; the feature stays inside the existing `src/scene`, `src/stage`, `src/visualization` and `src/views` modules. New code is limited to one pure model module (`fixtureLinks.ts`), one pure formatter (`capabilitySummary.ts`), three layout components and two dialogs.

## Implementation phases (for /speckit-tasks)

1. **Store foundation** (US1/US2 blocker): `FixtureSnapshot`, stage primitives, history fields + merge, `runCommand` fixture option, undo/redo order, remove deletion watcher.
2. **Fixture lifecycle commands** (US1): `addFixture`, fixture-aware delete/duplicate/copy/paste/rename, `addFixtureModel`, strip tool, `discardAddedObject`; Add menu; remove dialog, link select, Fixtures tab, `selectedFixtureId`.
3. **Migration** (US5): `migrateFixtureLinks`, call in `loadScene`, toast.
4. **Inspector building blocks** (US3): `InspectorSection`, `PropertyRow`, `SliderField`, header/overflow menu, section persistence, pane min width; port Transform and non-fixture properties.
5. **Fixture section** (US2): `updateFixture`, R8 behaviour, `FixtureSection` (DMX + LED), channel info, controller select, `FixtureDefaults` via command, validation summary.
6. **Channel mapping** (US4): compact editor, summary formatter, dialogs, header actions.
7. **Chrome & tabs** (US6): toolbar, Display popover, outliner header/indent, Stage tabs + Import/Export, Controllers links + focus request, Groups "Add selected fixtures".
8. **Verification**: quality gates, manual procedure in both targets.

## Complexity Tracking

No constitution violations; nothing to justify.
