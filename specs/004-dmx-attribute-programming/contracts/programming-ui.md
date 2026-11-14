# UI Contract: Attribute-Based DMX Programming

UI placement follows research R13. Components use PrimeVue 4 and Tailwind, like the existing editors.

## Graph nodes

### Attribute Output (category Output)
| Element | Behavior |
|---|---|
| Target select | "Clip target" (default), then groups, then DMX fixtures. A missing target shows the node in error state with the message "Target not found". |
| Attribute inputs | One per attribute (data-model §1), shown in the order: dimmer, shutter, pan, tilt, panTiltSpeed, color, colorTemperature, colorWheel, colorMacro, goboWheel, goboRotation, prism, prismRotation, zoom, focus. Each has an "enabled" checkbox. Disabled and unconnected inputs are unset. Connecting an input enables it. |
| Discrete inputs | An integer slot number. The tooltip lists the slot names of the first target fixture, e.g. "1 Open · 2 Red · 3 Blue". |
| Shutter input | A mode select (open / closed / strobe) plus a rate number (Hz). |
| Pan/tilt hint | If any target fixture has `panTiltNormalized`, the input label shows "(0–1, no angle range)" (FR-003). |

### Fixture Input (category Input)
Outputs: Index, Normalized Index, X, Y, Z, Has Position, Group Size. Outside a per-fixture run, it outputs 0, 0, 0, 0, 0, false, 1.

### Graph errors
- Fixture Input together with Attribute Outputs that resolve to different fixture lists: "Per-fixture graphs need one common target". The graph produces no output.

## Stage view

### Groups panel (new, beside Fixtures and Controllers)
- A list of groups with add, rename and delete. Deleting a group that items use asks for confirmation and states the number of uses.
- Group detail:
  - a member multiselect (DMX fixtures only)
  - an ordering select with the 8 modes
  - the resolved order as a list. It can be dragged in manual mode, is read-only otherwise, and marks fixtures without a scene position with an icon.

### Fixture settings → "Defaults" (new section for DMX fixtures)
- One row per supported attribute: the built-in default plus an "override" toggle and an editor (slider, color picker or slot select by name).

## Timeline

- **Track settings**: a "Default target" select (none / group / fixture).
- **Item context menu**: "Target…" opens the same select. It is shown for Look, Effect and Graph items.
- **Fade handles**: on Look and Effect items, small triangles at the top-left and top-right corners. Dragging changes `fadeIn` / `fadeOut`, snapping to the timeline grid. The fade is drawn as a diagonal overlay.
- **Warning badge**: an icon at the item's top right if the target is unresolved, a preset or aim target is missing, or an aim target is unreachable. The tooltip lists the warnings (fixture names included).

## Editors (UnifiedEditor)

### Look editor
- An "Add attribute" menu, then one row per attribute with a value-kind select:
  - **Single**: an editor by attribute (slider with unit, color picker, slot select by name, shutter mode + rate)
  - **Fan**: from/to editors plus a "Mirror" checkbox (continuous attributes only)
  - **Preset**: a select of presets of the matching kind
  - **Aim** (pan row only): a select of aim targets. The tilt row is then hidden.
- Fan timing slider 0–100 %.
- Slot selects show the names of the fixtures in the current item's target. When the target mixes models, names are grouped by model.

### Effect editor
- Fields per data-model §7. Fields that do not apply are hidden: base in relative mode, colors unless the attribute is color, circle/figure-8 unless panTilt.
- A phase preview strip: one dot per fixture of the selected item's target, animated with the effect, so wings, blocks and interleave are visible.

### Preset editor
- Kind (fixed after creation), common values (same editors as the look editor, limited to the allowed keys), and a per-fixture table (add fixture, edit values).
- Position kind: an "Aim at target" select.
- The uses count is shown read-only.

## Scene editor

- Add menu: "Aim target". It is placed at the camera target on the floor, named "Target n".
- Viewport: a crosshair gizmo (editor only). Selectable and movable with the existing tools. Hidden in the show window.
- Outliner: listed with a crosshair icon. Deleting a target that is in use shows the existing delete confirm extended with "Used by n looks/presets".
