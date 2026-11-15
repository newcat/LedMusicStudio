# UI Contract: Timeline Interactions

The user-facing interaction contract of the redesigned timeline. "Ctrl" means Cmd on macOS and "Alt" means Option. Shortcuts are active only while the timeline has focus and no text input inside it has focus (FR-005).

## Keyboard

| Keys | Action | Undo step | FR |
|---|---|---|---|
| Ctrl+Z | Undo | — | 002 |
| Ctrl+Y, Ctrl+Shift+Z | Redo | — | 002 |
| Delete, Backspace | Delete selected clips | "Delete" | 011 |
| Ctrl+A | Select all clips | — | 009 |
| Esc | Clear selection (also cancels a running box select) | — | 009 |
| Ctrl+C | Copy selection | — | 012 |
| Ctrl+X | Cut selection | "Cut" | 012 |
| Ctrl+V | Paste at playhead onto hovered track | "Paste" | 013 |
| Ctrl+D | Duplicate after selection | "Duplicate" | 014 |
| ← / → | Nudge by one snap unit (1 tick when snapping is disabled) | "Nudge" (consecutive nudges are separate steps) | 040 |
| Shift+← / Shift+→ | Nudge by one bar | "Nudge" | 040 |
| ↑ / ↓ | Move selection to previous/next track | "Move to track" | 040 |
| Space | Play/pause (unchanged) | — | — |

## Mouse

| Gesture | Where | Result | FR |
|---|---|---|---|
| Click | Clip | Select only this clip; becomes the anchor | 007 |
| Ctrl+click | Clip | Toggle this clip | 007 |
| Shift+click | Clip | Select the range anchor…clip on the same track (another track: acts like a click) | 007 |
| Double-click | Clip | Open its library item in the editor, select it in the library | 010 |
| Drag | Clip body | Move selection (time + tracks), grid and magnetic snapping, overlap-safe | 042, 044 |
| Alt+drag | Clip body | Move copies, originals stay | 015 |
| Drag | Resize handle | Resize selected resizable clips; magnetic + grid; clamped at neighbours | 042, 044 |
| Alt (held during any drag) | — | Snapping off for this gesture | 043 |
| Drag | Fade handle (hover/selected only) | Change fade (Shift or Alt: no snap) | 032 |
| Click | Target chip | Popover: Inherit, None, groups, fixtures (filterable); applies immediately | 021 |
| Right-click | Clip | Context menu: Target ▸, Make unique, Copy, Duplicate, Delete | 023 |
| Drag | Empty track space | Selection rectangle (live); Shift adds, Ctrl toggles | 008 |
| Click (no drag) | Empty track space | Clear selection | 009 |
| Click | Ruler | Set playhead (unchanged) | — |
| Wheel | Timeline | Vertical scroll | 035 |
| Shift+wheel | Timeline | Horizontal scroll | 035 |
| Ctrl+wheel | Timeline | Zoom around the mouse position | 035 |
| Pointer near a viewport edge during a gesture | — | Auto-scroll | 038 |

## Toolbar additions

Undo, Redo (disabled when unavailable, tooltip names the step), Zoom to fit, Follow playhead (toggle), position readout `bar.beat` · `m:ss`.

## Track header additions

A target chip showing the track's default target (or "No target"). Clicking it opens the same picker without "Inherit". Changes are one undo step.

## Clip inspector strip (bottom of the timeline panel, only with a selection)

| Field | Shown when | Format | Mixed |
|---|---|---|---|
| Count | always | "3 clips" | — |
| Source | always | library item name + open button ("3 items" if they differ) | — |
| Target | ≥ 1 targetable clip | picker with Inherit/None/targets | "Mixed" placeholder |
| Start | always | `bar.beat.tick` (e.g. `5.3.12`) | "Mixed" |
| Length | no audio clip selected | beats, decimal | "Mixed" |
| Fade in / out | all selected clips are Look/Effect | beats, decimal | "Mixed" |
| Make unique | ≥ 1 non-audio, non-script clip | button | — |

Each committed field change is one undo step and applies to all selected clips that support it. Length/fades are clamped per clip; length is also clamped at the next clip on the same track.

## Clip appearance

- Left colour bar and light tint in the effective target's colour. Explicit target: solid chip. Inherited: muted chip with "· track".
- Targetable clip without an effective target: hatched body plus warning icon (all widths).
- Hover tooltip: name, type, target (+ "inherited from track"), start `bar.beat.tick`, length in beats and seconds, fades.
- Layouts by width: see [data-model.md](../data-model.md#clip-layout--derived-not-saved).
