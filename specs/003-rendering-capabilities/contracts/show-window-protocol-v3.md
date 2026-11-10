# Contract: Show Window Protocol v3

**Feature**: 003-rendering-capabilities | Supersedes v2 ([001 contract](../../001-scene-editor/contracts/show-window-protocol.md)). Implemented in `src/visualization/protocol.ts`, `src/scene/sceneSink.ts` and `src/visualization/showWindowClient.ts`.

Transport, direction and message framing are unchanged from v2: `BroadcastChannel("lms-visualization")`, structured-clone objects, `{ protocol: 3, type, ... }`. A window that sees another protocol number shows "Please reload the visualization window". Old show windows (v2) see the mismatch and ask for a reload. Nothing is sent to them.

## Changes compared to v2

| | v2 | v3 |
|---|---|---|
| Window lifetime | `hello` only, windows are never forgotten | `hello`, `heartbeat`, `bye` plus a timeout (research R15) |
| Fixture values | `unknown` (number[] / Color[]) | `Uint8Array` per object |
| Value sending | always | only while at least one show window is alive **and** visible (FR-053) |
| Environment | — | `environmentChanged`, and `environment` inside `snapshot.scene` |

## Show → main

| type | payload | when |
|---|---|---|
| `hello` | `{ windowId }` | The view is initialized (also after a reload). |
| `heartbeat` | `{ windowId, visible: boolean }` | Every 2 s, and immediately on `visibilitychange`. |
| `bye` | `{ windowId }` | On `pagehide`. |

The main window treats a window as **gone** after `bye`, or after 6 s without a `heartbeat`. It treats a window as **active** while it is not gone and its last `visible` was true. `BroadcastSceneSink.active` = at least one active window.

## Main → show

| type | payload | semantics |
|---|---|---|
| `snapshot` | `{ target, scene: SceneSnapshot (incl. environment), fixtures: Record<objectId, { config, value: Uint8Array }> }` | As in v2. |
| `asset` | as v2 | |
| `objectsChanged` / `objectsRemoved` / `camerasChanged` | as v2 | Sent to all windows, active or not, so a hidden window is current when it becomes visible. |
| `environmentChanged` | `{ environment: SceneEnvironment }` | Haze, hazer coupling or ambient changed. Batched per frame like objects. |
| `fixtureConfigs` | `{ configs: Record<objectId, unknown> }` | As v2. Always sent, because configs are scene state. |
| `fixtureValues` | `{ values: Record<objectId, Uint8Array> }` | Latest value per object, batched per main-window frame. **Only sent while the sink is active.** When the sink turns active, a full `fixtureValues` with all current values is sent first. |
| `reset` | as v2 | |

### Value encoding

| Visualization | `Uint8Array` content |
|---|---|
| DMX types (all except LED strip) | The fixture's DMX channel values in mode order (`DmxFixture.value`), index = channel index of the mapping. |
| LED strip | `[r0, g0, b0, r1, g1, b1, …]`, length = 3 × `numLeds` (the fixture's pixel count). |

The conversion happens once in `VisualizationServer` before fan-out, so local and broadcast sinks get the same object.

## Show window behavior

- **Inactive while hidden** (`document.visibilityState !== "visible"`): the view stops rendering and only keeps the latest value per object. When it becomes visible again it applies them once and resumes.
- **One frame, one application** (FR-054): incoming values are applied once per rendered frame. Several `fixtureValues` messages between two frames collapse to the latest value.
- **Local view preferences** (quality, FPS overlay, photosensitivity) are read from `localStorage` and follow the `storage` event (research R16). They are not part of the protocol.

## Guarantees (in addition to v2)

- With no show window open, or all of them hidden, the main window posts no `fixtureValues` (SC-006).
- A visible change (for example dimmer to full) appears in an active show window within 2 of its frames (SC-004). The change is posted at the end of the main window's frame and applied at the start of the show window's next frame.
