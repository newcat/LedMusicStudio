# Contract: Inspector & Editor UI

**Feature**: 006-fixture-editing-redesign

Layout and behaviour of the scene editor inspector and the surrounding chrome. Spacing tokens: `--insp-gap-1` 4 px, `--insp-gap-2` 8 px, `--insp-gap-3` 12 px, `--insp-gap-4` 16 px (defined once on `.inspector`).

## Building blocks (`src/scene/editor/inspector/`)

### `InspectorSection.vue`

```
▾ Title                                   [#actions slot]
  content (v-show)
```

- Props: `name` (persistence key), `title`, `defaultOpen = true`. Slots: default, `actions`, optional `summary` (muted text shown next to the title when collapsed).
- Header: full-width toggle button (chevron + title) with the actions slot outside the button (no nested buttons). Height 32 px, padding `0 var(--insp-gap-3)`, bottom border `var(--p-content-border-color)`.
- Content padding `var(--insp-gap-2) var(--insp-gap-3) var(--insp-gap-3)`, rows separated by `var(--insp-gap-2)`.
- Open state from `useLocalStorage("lms.inspectorSections")[name]`; exposes `open()` and `scrollIntoView()` for the validation summary.

### `PropertyRow.vue`

- Props: `label`, optional `hint` (muted line under the control), optional `warning` (orange line under the control), `for` id.
- Grid `minmax(5.5rem, 35%) minmax(0, 1fr)`, column gap `var(--insp-gap-2)`, label 0.8125rem, muted, vertically centred to the control, ellipsis on overflow with full text as `title`.
- Container query: below 280 px inspector width the row becomes one column (label above control).
- Convention: controls inside are `size="small"` and `fluid` (research R11).

### `SliderField.vue`

Slider + `InputNumber` (width 4.5rem, `size="small"`) in one row; used for edge softness, pixel size, intensity.

## Inspector layout

```
┌───────────────────────────────────────────┐
│ [icon] [Name_______________________] [⋯]  │  header, padding 8/12, no chip
│ ⚠ No DMX profile · No controller          │  validation summary (only if problems)
├───────────────────────────────────────────┤
│ ▾ Transform                               │
│   Position  [x][y][z]                     │
│   Rotation  [x][y][z]                     │
│   Scale     [x][y][z]                     │
│ ▾ Fixture                                 │
│   Profile   [Robe ColorSpot 2500E AT  ✎]  │
│   Mode      [24-channel 1        ▾]       │
│   Address   [1      ]                     │
│             1–24 · ⚠ overlaps "Spot 2"    │
│   Controller[DMX USB             ▾]       │
│ ▾ Appearance                              │
│   Type      [Moving Head         ▾]       │
│   Model     [▣ Moving head (wash)▾]       │
│   Size      134 %                  [↺]    │
│ ▾ Beam & movement                         │
│ ▸ Channel mapping        18/24 [Auto]     │
│ ▸ Defaults                                │
└───────────────────────────────────────────┘
```

### Header

- Kind icon (same icon as the outliner row), name `InputText size="small" fluid` (commit on blur/Enter, existing rules), overflow `Button text rounded icon="pi pi-ellipsis-v"` opening a `Menu`: Duplicate, Delete, separator, Open OFL page (DMX with `oflURL` only).
- Multi-selection: "N objects selected, edits apply to all" stays as a muted line under the header; only Transform is shown (existing behaviour).

### Validation summary

- Compact `Message severity="warn" size="small"`; one entry per problem, each a link-styled button: "No DMX profile" → Fixture section, "No mode" → Fixture, "No controller" → Fixture, "Channels overlap with …" → Fixture, "Mapping may be outdated" → Channel mapping. Clicking opens and scrolls to the section.

### Sections per object kind

| Kind | Sections |
|---|---|
| DMX fixture | Transform, Fixture, Appearance, Beam & movement (Spot, Moving Head), Channel mapping, Defaults (profile + mode set) |
| LED strip | Transform, Fixture (LED count, controller), Appearance (model, size), Strip (path, interpolation, closed loop, pixel size, intensity) |
| Effect / generic types | Transform, Fixture, Appearance, the type's settings section ("Effect" / "Light"), Channel mapping, Defaults |
| Shape / imported model / library asset | Transform, plus the kind's existing properties inside one section named after the kind ("Shape", "Model", "Asset") |

### Fixture section (DMX)

| Row | Control | Notes |
|---|---|---|
| Profile | Button (outlined, small, fluid) showing `manufacturer model` or "Choose profile…" | opens `ChooseFixtureDialog` (reused); external-link icon button when `oflURL` |
| Mode | Select of `definition.modes` | hidden until a profile is chosen |
| Address | InputNumber 1–512 | hint: channel range; warning: overlap names / "does not fit into the universe (ends at 530)" |
| Controller | Select: None + compatible controllers | |

### Fixture section (LED strip)

| Row | Control |
|---|---|
| LEDs | InputNumber 1–10000, hint "N per metre" |
| Controller | Select: None + compatible controllers |

### Channel mapping section

- Header actions: badge `mapped/total` (Tag, secondary, small), `Button text small icon="pi pi-sparkles" label="Auto-Assign"` (existing confirm popup when manual entries would be replaced).
- Body, in order:
  1. Outdated warning (one compact Message, no emoji) if the mode changed.
  2. Groups (Position, Intensity, Color, Beam…): group label 0.75rem uppercase muted; rows = mapped capabilities of the group.
  3. Capability row: `PropertyRow label=capability` with the channel Select (`— not mapped —`, `1: Pan`, …) and a 6 px source dot after it (tooltip "Auto-assigned" / "Edited manually"). Summary line (muted 0.75rem) via `PropertyRow hint`.
  4. Clicking the chevron at the row's end expands detail rows (each a `PropertyRow`): Fine channel, Default (unmapped linear keys), Range from / to (single linear segment), Wheel; plus a text button "Edit ranges… (N)" opening the ranges dialog.
  5. "Show N unmapped" / "Hide unmapped" text button.
  6. "Edit cells… (N)" text button when the mapping has cells; spread hint unchanged.
  7. Unmapped channels note (muted).
- `CapabilityRangesDialog.vue`: header "Pan – ranges", width `min(48rem, 90vw)`, table columns From, To, Kind, Values, remove; "Add range"; controls `size="small"`; edits apply immediately.
- `CapabilityCellsDialog.vue`: header "Pixel cells", table Emitter, Pixel, R, G, B, W, A, UV, Dimmer with small Selects.

## Scene editor chrome

- **Pane sizes**: Outliner/library column 18 %, viewport flexible, inspector default 24 % with `min-size` = 320 px converted to percent of the editor width (research R13).
- **Toolbar** (one row at 1600 px): `[+ Add ▾] [Draw strip] | [Move][Rotate][Scale] [World] | [Snap][0.25 m][15°] | [View ▾][Cameras ▾] [Environment] [Display] [Arrange ▾] … [Undo][Redo]` (icon-only with tooltips where the label duplicates a menu: Draw strip, Undo, Redo). Grid / Axes / Labels / Focus move: Grid, Axes, Labels → Display popover section "Scene editor"; Focus → View menu (shortcut F unchanged).
- **Add menu**: Box, Cylinder, Plane, Sphere, Group | DMX fixture, LED strip, Import model (GLB)… | Aim target.
- **Outliner**: header row like the asset library header: title "Scene", right-aligned `+` button opening the Add menu. Leaf rows have no toggle placeholder; row height 28 px, padding `0 var(--insp-gap-2)`.
- **Context menu**: "Open fixture settings" removed.

## Stage view

- Tabs (PrimeVue `Tabs`): Controllers, Visualization (default), Groups.
- Right-aligned, separated from the tabs: `Button text small` "Import" and "Export" with the existing icons and tooltips "Import stage…", "Export stage…".

## Controllers tab

"Controlled fixtures" becomes a list of text buttons (fixture names); clicking one → Visualization tab, fixture object selected and framed.

## Groups tab

"Add selected fixtures" `Button outlined small` next to the member select; disabled when no DMX fixture object is selected in the scene; tooltip shows how many would be added.
