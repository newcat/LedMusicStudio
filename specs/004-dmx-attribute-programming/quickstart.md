# Quickstart & Validation: Attribute-Based DMX Programming

Scenarios that prove the feature end to end. They expand the spec's 10-step manual verification (constitution III). Run all of them in **both** targets unless marked otherwise. Details: [data-model.md](./data-model.md), [contracts/](./contracts/), [research.md](./research.md).

## Prerequisites

- `pnpm i`, WASM built once (`src/rust`: `wasm-pack build --target web`).
- Desktop: `pnpm electron:dev`. Browser: `pnpm dev`, then open the printed URL.
- Quality gates before committing: `pnpm lint` and `pnpm build`.
- Test rig (save it as `specs/004-dmx-attribute-programming/test-rig.lmp` during the first implementation pass):
  - 8 moving heads with RGB mixing and 16-bit pan/tilt, on a truss, linked to Moving Head visualizations
  - 2 moving heads with only a color wheel
  - 1 CMY spot
  - 1 moving head without a scene object
  - 1 LED strip with an existing strip graph
  - one audio track at a known BPM

## Scenarios

**Q1 — Attributes on different models (US1, SC-001, SC-002)**: Graph → Attribute Output, one per model type, pan 45°, tilt 30°, color red, dimmer 1. Expected:
- Same direction relative to mounting in the preview.
- RGB head: red channel 255, green/blue 0.
- Wheel head: its red slot.
- CMY: magenta and yellow full, cyan 0.
- Measure time-to-result for SC-001 (< 1 min from a newly patched head).

**Q2 — 16-bit and ranges (US1.3)**: On a 540° pan head, set pan 90°. Expected: coarse/fine encode the value the preview decodes back to 90° (± 0.1°). Check with the dev helper `programming.debug()`.

**Q3 — Fallbacks (US1.4–US1.6)**: Use a fixture without an angle range and without a model: pan/tilt are offered as 0–1 with a hint. Select a gobo by name: the named gobo is shown. Check an unmapped channel: it stays at the OFL default, and a raw DMX node can still set it.

**Q4 — Layering (US2.1–US2.3, US2.5)**: Track 1 has a position graph, track 2 has a color-only Attribute Output, overlapping. Expected: during the overlap, position and color both apply. Before and after, color is white (the default) and dimmer is 0 where no clip sets it. Put a dimmer output on both tracks: track 2 (lower) wins.

**Q5 — Determinism (US2.4, SC-004)**: Play, pause at 5 positions and note the DMX values. Scrub away and jump back to each position. Expected: identical values (including effect phase and fades).

**Q6 — Compatibility (US2.6, US2.7, SC-006)**: Open a project from before this feature, with raw DMX nodes and LED strip graphs. Expected: identical output. Raw node on track 2 plus an attribute dimmer on track 1: the raw value wins on the dimmer channel. Swap the tracks: the attribute wins.

**Q7 — Defaults (FR-012)**: Override the default tilt of one head to 60°. With no clip active, that head tilts 60° and the others stay at 0°.

**Q8 — Groups and ordering (US3)**: Create the group "Truss" (8 heads). Switch the ordering through all 8 modes and compare the list with the scene. Move a head across: the order updates. The fixture without a scene object is last with an icon. Delete a member fixture: it is removed from the group and clips keep running.

**Q9 — Track default target (US3.4)**: Set track 3's default target to "Truss". Drop a Look on track 3: its target is "Truss". Change it to a single fixture: allowed.

**Q10 — Per-fixture graph (US4, SC-005)**: Attribute Output (target: clip target) with tilt = 30 · sin(2π·(progress + normalized index)). Put the item on the "Truss" track. Expected: a wave. Add a 9th head to the group: the wave extends. Add an Afterglow-style stateful node to the same graph: no cross-fixture flicker. Graph with a Fixture Input and two outputs targeting different groups: the error "Per-fixture graphs need one common target".

**Q11 — Effects (US5, SC-003)**: A position look on track 1. Above it, a relative circle effect on "Truss": size [20°, 20°], rate 2 beats, spread 360°. Expected: circles around the look position in tempo, evenly phased. Then:
- wings 2 → mirrored from both ends
- blocks 2 → pairs
- interleave 2 → odd/even
- change the BPM → speed follows
- dimmer sine effect → dimmer swings 0..1
- color effect red ↔ blue → a phased color wave
- fade-in 2 beats → size ramps up

Measure the creation time for SC-003 (< 2 min).

**Q12 — Looks and fades (US6)**: Look A (pan fan −30..30°, tilt 60°, blue, gobo 2) and Look B (pan 0°, tilt 20°, red, gobo 4), overlapping, with B's fade-in = the overlap. Expected: position and color interpolate (no dark midpoint in color), the gobo switches once at mid-fade. Set B's fan timing to 50 %: the fade ripples along the group order and ends at the same time.

**Q13 — Presets (US7, SC-007)**: Save the position preset "Drummer" and use it in 3 looks. Edit the preset: all 3 looks change. Give the preset a per-fixture value for 2 heads only: those 2 use it, the others use the common value. Delete the preset: the warning shows "3 uses". Confirm: the looks keep the last values.

**Q14 — Aim targets (US8, SC-008)**: Add the aim target "Singer". Look on 4 heads at different positions: pan = aim at "Singer". Expected: beams meet at the target (≤ 0.1 m, judged in the preview with the editor grid). Move a head: it stays on target. Move the target: all follow. Move the target behind a head's range: clamped, plus a warning badge naming the fixture. Delete the target: the heads go to center pan/tilt with a warning.

**Q15 — Performance (SC-005)**: 32 heads, a per-fixture graph on all of them, one effect and one look overlapping, at 30 fps on the reference machine. `programming.debug()` shows graphs ≤ 10 ms and engine ≤ 2 ms per frame. No dropped frames in the timeline position display.

**Q16 — Persistence (FR-036)**: Save and reload a project containing groups, defaults, track targets, item targets and fades, looks, effects, presets and aim targets. Expected: everything is restored, and playback is identical (Q5 positions).

**Q17 — Hardware (desktop only)**: With a DMX interface, play Q1, Q4 and Q11. Expected: the hardware matches the preview.
