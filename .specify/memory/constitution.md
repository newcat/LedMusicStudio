# LEDMusic Studio Constitution

## Core Principles

### I. Two Targets, One Codebase

LEDMusic Studio ships as an Electron desktop app and as a browser build (GitHub Pages).
Both are first-class.

- Every feature MUST work in both targets. When a feature needs a native capability the
  browser lacks, the browser build MUST degrade gracefully, for example by disabling the
  feature with a clear hint, and MUST NOT crash or break unrelated features.
- Platform-specific code MUST go through the native adapter layer (`src/native`). Feature
  code MUST NOT check the runtime or call Electron APIs directly.
- The browser build (`pnpm build`) MUST stay green, because it is what CI deploys.

Rationale: the browser build is the zero-install entry point and the Electron build
gives native access. Keeping one abstraction stops the two from drifting apart.

### II. Typed Boundaries & Quality Gates

- TypeScript MUST be used for all application code. Avoid `any` and `@ts-expect-error`.
  When you do need one, add a comment saying why (for example, an untyped third-party
  library).
- Types shared between Rust (`lms_bridge`, `src/rust`) and TypeScript MUST be generated
  (ts-rs bindings in `lms_bridge/bindings`, wasm-bindgen output). Generated files MUST NOT
  be edited by hand. Change the Rust source and regenerate them instead.
- Every change to the bridge protocol MUST update the Rust types and the regenerated
  bindings in the same change.
- `vue-tsc --noEmit` (via `pnpm build`) and `pnpm lint` MUST pass before a change is
  merged to `main`.

Rationale: the app talks to Rust code over two boundaries (WASM and the WebSocket
bridge). Generated types turn protocol drift into compile errors instead of runtime bugs
on real hardware.

### III. Manual Verification by Default

Automated tests are not required for now.

- Every feature specification MUST include a short, concrete manual verification
  procedure: the steps to run, which target(s) to use, and the expected visible or
  hardware result.
- That procedure MUST be carried out before the feature counts as done, in both targets
  wherever principle I applies.
- Contributors MAY add automated tests where they find them useful (pure logic is a good
  candidate). Doing so creates no obligation to cover other code.

Rationale: most of the project's value is in visual, audio and hardware output, where
manual checks catch what matters. A written procedure keeps those checks repeatable.

### IV. Free Iteration Before 1.0

Until a 1.0 release, the project is a work in progress.

- Project file formats (`SavedState` and the per-item `save()`/`load()` state), the bridge
  protocol and internal APIs MAY change without backward compatibility or migrations.
- A change that breaks loading of existing project files MUST say so in its commit
  message or PR description.

Rationale: locking formats down too early would slow down the design work that is still
in progress. Compatibility guarantees are planned for 1.0 through a constitution
amendment.

### V. Simplicity First

- Build the simplest thing that meets the current specification (YAGNI). Abstractions,
  dependencies and configuration options MUST meet a present need.
- Adding a new runtime dependency MUST be justified in the plan or PR, noting why existing
  dependencies or a small amount of in-house code are not enough.
- Additional complexity in a plan MUST be justified in its Complexity Tracking section.

Rationale: the project is maintained mostly by one person. Every abstraction and
dependency adds a cost that person pays for a long time.

## Technology Stack & Constraints

- **Frontend**: Vue 3 (Composition API), TypeScript, Pinia, PrimeVue, Tailwind CSS, Vite.
- **Node graphs**: BaklavaJS. **3D stage visualization**: Three.js.
- **Performance-critical logic**: Rust compiled to WebAssembly (`src/rust`, wasm-pack).
- **Hardware bridge**: Rust (`lms_bridge`), connected over WebSocket, with ts-rs bindings.
- **Desktop shell**: Electron (`electron/`).
- **Package manager**: pnpm. Lockfile changes MUST be committed with the dependency change
  that caused them.
- Adding a new core framework or replacing a listed technology needs a constitution
  amendment.

## Development Workflow

- `main` is the integration and deployment branch. A push to `main` deploys the browser
  build to GitHub Pages.
- This is a single-person hobby project, so commits go **directly to `main` by default**.
  Use a feature branch only when there is a good reason, for example: long-running or
  experimental work that would leave `main` broken for a while, a change you may want to
  throw away, or a contribution from someone else that needs review.
- Before committing (or merging) to `main`: the quality gates (principle II) pass, and the
  manual verification procedure (principle III) has been carried out.
- Larger features follow the Spec Kit flow (`/speckit-specify` → `/speckit-plan` →
  `/speckit-tasks` → `/speckit-implement`). Each plan's Constitution Check MUST confirm
  principles I–V or justify any deviation.
- Code style follows the repository's Prettier and ESLint configuration.

## Governance

- This constitution takes precedence over other development conventions in this
  repository. If they conflict, the constitution wins until it is amended.
- Amendments are made by editing this file, preferably via `/speckit-constitution`, and
  committing the change with a message that states the new version and what changed.
- Versioning follows semantic versioning:
  - MAJOR: a principle is removed or redefined in an incompatible way (for example, ending
    principle IV at 1.0).
  - MINOR: a principle or section is added, or guidance is materially expanded.
  - PATCH: clarifications and wording fixes with no change in meaning.
- Compliance is checked in each plan's Constitution Check and during review before
  merging to `main`. Deviations MUST be recorded and justified in the plan's Complexity
  Tracking section.
- Principle IV is expected to be replaced by a compatibility and migration principle when
  the project approaches 1.0.

**Version**: 1.0.0 | **Ratified**: 2026-11-07 | **Last Amended**: 2026-11-07
