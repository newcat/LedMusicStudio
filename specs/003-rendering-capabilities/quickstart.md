# Quickstart & Validation: Rendering & Fixture Capability Upgrades

**Feature**: 003-rendering-capabilities | **Plan**: [plan.md](./plan.md)

How to run the app and check that the feature works from end to end. The binding step list is the spec's [Manual Verification](./spec.md#manual-verification-required-by-constitution-principle-iii) section. This guide adds setup, test data, measurements and the mapping to requirements. UI details: [contracts/rendering-ui.md](./contracts/rendering-ui.md). Data rules: [data-model.md](./data-model.md). Protocol: [contracts/show-window-protocol-v3.md](./contracts/show-window-protocol-v3.md).

## Prerequisites

- Node and pnpm (`packageManager` in `package.json`), then `pnpm install`. Build the WASM once (`pnpm build:wasm`) if it is not there yet.
- Features 001 and 002 are in place (the scene editor with the asset library).
- Test data:
  - **OFL fixtures** from the bundled library:
    - Stairville MH-X50 (moving head with a color wheel, a gobo wheel with embedded SVG gobos, a prism and 16-bit pan/tilt)
    - one wash moving head with RGBW and zoom
    - an RGBW par
    - a CMY fixture (any profile with Cyan/Magenta/Yellow channels)
    - a 12-cell pixel bar (matrix definition)
    - a laser, a hazer and a strobe
    - plus five more fixtures for SC-001, ten in total (record the names in the test notes)
  - A **project saved before this feature** with a moving head, a spot, a generic fixture and an LED strip visualization (load rules 2–5).
  - A **controller setup** to drive values: the DMX panel in Stage → Controllers, or a timeline pattern.
  - The **reference scene** `specs/003-rendering-capabilities/reference-scene.lmp` (data-model.md §10), created during implementation.
- For SC-003: a laptop with integrated graphics. For step 9 of the spec: a USB-DMX interface and real fixtures (desktop build only).

## Quality gates (before committing to `main`)

```powershell
pnpm lint
pnpm build            # vue-tsc --noEmit + browser build (what CI deploys)
```

Both must pass (constitution II). If 002 assets were changed (effect models got a `beam`), also check the asset workbench (`/asset-workbench.html`): "0 errors".

## Run

| Target | Command | Notes |
|---|---|---|
| Browser | `pnpm dev`, open http://localhost:3000 | "Open Visualizer" opens the show window (protocol v3). |
| Desktop | `pnpm electron:dev` | Check localStorage preference sync between the main window and the show window. |
| Browser production build | `pnpm build`, then `pnpm serve` | Frame-rate measurements (SC-002/003) are taken on production builds only. |

## Validation scenarios

Run each scenario in the browser **and** the desktop build unless marked otherwise. "Values" means setting DMX channel values with the DMX panel.

| # | Scenario | Steps | Expected | Covers |
|---|---|---|---|---|
| Q1 | Auto-mapping on creation | Add the MH-X50 with a mode that has fine channels. Create its Moving Head visualization. Open the inspector. | Pan, tilt (with fine), dimmer, shutter (with segments), color wheel (swatches), gobo wheel (thumbnails, embedded SVGs), gobo rotation, prism and zoom are mapped, all with the `auto` badge. Unsupported channels (for example "Reset") are listed as unmapped. | US2.1–2, FR-010, FR-011 |
| Q2 | Manual change is kept | Change the dimmer channel by hand, then change the fixture's start channel and re-open the inspector. | The dimmer is `manual` and unchanged. Auto-Assign asks before replacing it, and after confirming it is `auto` again. | US2.3, FR-011 |
| Q3 | Mode change | Switch the fixture to another mode. | "Fixture mode changed" notice. Auto-Assign maps the new mode's channels. | US2.4 |
| Q4 | Dimmer, shutter, strobe | Dimmer 0 → 255. Shutter closed / open / strobe slow → fast. Turn the flash limit off, then set a 10 Hz strobe. | Beam, floor spot and lens go from off to full. Closed = no light, open = steady. With the limit on, flashing ≤ 3/s. With the limit off, 10 Hz flashes visibly and never looks steady. | US1.1–2, FR-061, SC-007, R5 |
| Q5 | Color mixing | RGB par: R+G+B full = white. RGBW: W adds white. CMY fixture: C+M+Y full = dark, C only = cyan. No color channel mapped (Generic) = white. | As stated. | US1.3, FR-003 |
| Q6 | Wheels | Step the color wheel through its slots, set a split color, set continuous rotation. Select gobos, rotate a gobo, engage the prism. | Slot colors from the definition, a two-tone split, smooth transitions between slots. The gobo pattern shows on the floor and in the beam (haze > 0) and rotates. The prism splits the beam into the facet count (also on the floor). A slot without an image shows a generic pattern. | US1.4, US1.6–7, FR-004 |
| Q7 | Zoom and 16-bit | Zoom 0 → 255. Pan coarse 128 with fine 0 → 255. | The beam angle sweeps the mapped angle range. The fine channel moves the head in small steps (no 1° jumps). | US1.5, US1.8 |
| Q8 | Realistic movement | Pan 0 → 255 → 0 quickly. Change the target mid-move. Switch the object to "Instant". | The head takes about 1.2 s for the full range, slows down at the target and redirects smoothly. Instant jumps. | US1.9, FR-002 |
| Q9 | Haze and surfaces | Four moving heads aimed at the floor, haze 0 % → 100 %. Aim one at a decoration item. | 0 %: beams almost invisible, floor spots and lenses visible. The beams get gradually more visible up to solid at 100 %. Spots get dimmer and wider with distance. | US3.1–3, FR-020, FR-021 |
| Q10 | Shadows and cut-off | Display → editor quality High. Put a box between a head and the floor. | The box casts a shadow in the light spot, and the beam ends at the box. At Medium the beam still stops at the floor (center ray) but there are no shadows. | US3.4–5, FR-022 |
| Q11 | Over-budget lights | Low quality, 40 moving heads on. Turn the camera. | No beam or lens disappears. Lights out of view lose detail first, and the surface light changes without flicker. | FR-023, edge case |
| Q12 | Reference scene performance (production build) | Open the reference scene, start its timeline, open the show window full screen at 1920×1080, Medium, FPS overlay on. Take readings after 30 s. Repeat at Low on the integrated-graphics laptop. | ≥ 50 fps on the reference machine at Medium (SC-002). ≥ 30 fps on the laptop at Low (SC-003). Beams, colors and positions look the same at every level. Record the fps per level in the test notes. | US6.1, SC-002, SC-003 |
| Q13 | Per-view quality and ambient | Editor High + House lights, show window Low + Dark. Change the show quality from the show window's gear menu. | Each view uses its own settings. The editor's Display popover reflects the show change (storage sync). Dark = only fixtures light the scene. | US6.2, US7.1–2, FR-050, FR-060 |
| Q14 | Resize | Resize the show window from small to full screen. | Bloom and beams stay sharp, with no blurry or overscaled bloom. | US6.5, FR-051 |
| Q15 | Hidden views do no work | Run the reference scene. Switch the app to Programming and close the show window. Watch the browser task manager (or Electron's process metrics). Then minimise an open show window. | The GPU and CPU load of the visualization drop to idle. Debug log: no `fixtureValues` posted (BroadcastChannel). Re-opening shows the current state immediately. | US6.4, FR-053, SC-006 |
| Q16 | Latency | Show window at 60 fps: set the dimmer from 0 to 255 while recording the screen at 60 fps. | The light appears within 2 frames of the main window's change. | SC-004, FR-054 |
| Q17 | LED strip path and pixels | Link a 300-pixel LED strip. Inspector "Draw path": click 6 points around a platform edge, switch to a smooth curve, finish. Run a chase pattern. | 300 separate points in order along the curve. The chase moves along the path, and surfaces near the strip pick up the colors of the nearby pixels. Edit path: drag a point and insert a point, each undoable. | US4.1–3, FR-030–032 |
| Q18 | Many strips, many pixels | Duplicate the strip to 50 strips. Set one strip to 2000 pixels with a 0.3 m path. Draw a self-crossing path. | All strips display. The 2000 pixels merge visually but stay in order. On the self-crossing path, pixels are evenly spaced. | US4.5, FR-033, edge cases |
| Q19 | Pixel bar cells | Add a 12-cell pixel bar (Generic). Set cell colors individually, then run a chase. | Each cell shows its own color. A hint appears if the pixel count ≠ the model cells. | US4.4, FR-034 |
| Q20 | Special effects | Place a laser, flame projector, CO2 jet, cold spark, hazer, strobe and blinder. Map or auto-map them and trigger each. Enable "Hazers raise haze" and run the hazer for 30 s, then stop it. | Laser: thin beams, pattern/size/rotation follow the channels, visible only with haze, dots on surfaces. Flame: a column for as long as triggered, height follows the channel, warm flicker on surroundings. CO2: a plume that fades after release. Sparks: a fountain with height. Hazer: fog sprites; the effective haze rises over seconds and decays after the stop. Strobe/blinder: bright flashes that light the scene; blinder cells individually. Unmapped trigger: effect off with notice. | US5.1–6, FR-040, FR-041 |
| Q21 | Old project | Open the project saved before this feature. | It loads without a "problems" toast. The moving head keeps its pan/tilt/color mapping (manual), the spot its RGBW, and the strip lies between its old start and end. The environment has its defaults. | Load rules 1–5 |
| Q22 | Device fallback | Force the fallback (dev flag `?forceFallback=shadows`, added during implementation) at High. | A one-time HUD notice; the scene renders without shadows; no crash. | FR-055, edge case |
| Q23 | Hardware match (desktop only) | Drive real fixtures and the preview with the same cues (dimmer, strobe, color, position). Score 10 cues. | ≥ 9 of 10 judged matching. | SC-005, spec step 9 |

## SC-001 checklist

For each of the 10 fixtures, record: visualization type picked, the FR-001 capabilities the fixture has, how many were auto-mapped, and how many react correctly in the preview. The target is 100 %. Any miss is a bug in `autoMap.ts` or `oflResolve.ts`, not a manual-mapping case.

## Done criteria

- Quality gates green. Q1–Q22 pass in both targets, Q23 in the desktop build.
- Frame-rate readings (Q12) are recorded in the commit or PR description that closes the feature.
- The spec status is set to Implemented after the manual verification (constitution III).
