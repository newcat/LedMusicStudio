# Contract: Show Window Protocol

**Feature**: 001-scene-editor | Replaces the message set in `src/visualization/stageRenderer.ts` (`StageRendererPayloads`).

Transport: `BroadcastChannel("lms-visualization")` between the main window and any number of show windows (`visualization.html`), same origin, in both Electron and the browser. Messages are **structured-clone objects** (no JSON strings). Every message has `{ protocol: 2, type, ... }`; a receiver ignores messages with another `protocol` value and shows "Please reload the visualization window" if it sees one.

Direction: main → show, except `hello`. The show window never changes the scene (FR-050). Its camera is local to it (FR-052).

## Show → main

| type | payload | when |
|---|---|---|
| `hello` | `{ windowId: string }` | Show window has initialized its renderer (also after reload). |

## Main → show

| type | payload | when / semantics |
|---|---|---|
| `snapshot` | `{ target: windowId, scene: SceneState without asset data, fixtures: Record<objectId, { config, value }> }` | Reply to `hello`. The receiving window rebuilds its view completely. Other windows ignore it (`target` ≠ own id). |
| `asset` | `{ target: windowId \| "*", assetId, mimeType, data: ArrayBuffer }` | After `snapshot` for each referenced asset, and to `"*"` when a model is imported. Objects referencing an asset not yet received render as a loading placeholder. |
| `objectsChanged` | `{ objects: SceneObject[], rootOrder: string[] }` | Added or modified objects (full object states). Batched: at most one message per animation frame in the main window. |
| `objectsRemoved` | `{ ids: string[] }` | Removed objects (descendants are listed explicitly). |
| `camerasChanged` | `{ cameras: CameraPosition[] }` | Saved camera positions changed; the show window updates its camera list but does not move. |
| `fixtureConfigs` | `{ configs: Record<objectId, unknown> }` | Renderer configs of fixture visualizations changed (e.g. channel mapping). |
| `fixtureValues` | `{ values: Record<objectId, unknown> }` | Current renderer values (DMX channel arrays, LED colors). Batched per frame; not sent while playback rendering is paused (`VisualizationServer.pause`). |
| `reset` | `{}` | Project was loaded or reset; a `snapshot` follows to `"*"` (sent as one `snapshot` per known `windowId`). |

## Guarantees

- A show window that opens at any time (also twice) reaches the current scene and fixture state after its `hello` (US 5 scenario 4, edge case "opened twice").
- Changes reach open show windows within 0.5 s (FR-051); in practice within one or two animation frames.
- Editor-only data (selection, labels, handles, grid, editor proxies) is never sent.
- Hidden objects are sent (with `visible: false`) and not rendered.

## Show window local state

- Camera: `OrbitControls`, starting at the show-default camera position (or the first / the editor camera, see data-model). A camera menu (top-right overlay, auto-hidden after 3 s without mouse movement) lists saved positions.
- On `pagehide` it disposes its view (no leaks, FR-062).
