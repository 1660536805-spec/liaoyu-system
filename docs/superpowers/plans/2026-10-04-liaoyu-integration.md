# 弦养 0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `liaoyu0-1` one runnable H5 app with the `main` visual flow and the real `xianyang-s4` pose, sound and record behavior.

**Architecture:** Put the maintained Vue/Vite application in `app/` and build to root `dist/`, which the existing preview server serves. Rebuild the nine `main` screens as Vue views, while a session controller owns camera, pose, judge, audio and record lifecycle. Keep presentation and detection joined through events and stable move IDs.

**Tech Stack:** Vue 3.5, Vite 6, MediaPipe tasks-vision, Web Audio, browser localStorage, Node tests, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-04-liaoyu-integration-design.md`

## Global Constraints

- Keep the existing eight Baduanjin move IDs and `xianyang.records.v1` record format.
- Request camera access only when entering training or pose diagnostics.
- Keep model, WASM, audio and artwork local; no CDN, backend, accounts or other exercise sets.
- Require HTTPS for phone camera access and document it.
- Preserve `main`'s nine-screen visual flow and use its `dist/art/` imagery as the source.

## Review Focus

- Storage unavailable or malformed: onboarding and records remain usable in memory and display a save warning.
- Camera permission denied: a visible retry/manual route appears; no hanging loader.
- Multiple hits for one move: one chord/string event and one move entry.
- Leaving training mid-load: no active camera tracks, timers or delayed navigation.
- Refreshing after a partial session: exactly one partial record, no fabricated completed session.

---

### Task 1: Import the maintained engine application and establish one build

**Files:** Create `app/package.json`, `app/package-lock.json`, `app/index.html`, `app/vite.config.js`, `app/src/**`, `app/public/**`; modify root `README.md`, `.gitignore`, `server.cjs`; test `app/scripts/build.test.mjs`.

**Interfaces:** Produces `npm --prefix app run build` and `npm --prefix app run test:all`; build output is root `dist/` with all required public assets.

- [ ] Add a build test that checks `dist/index.html`, `dist/models/pose_landmarker_lite.task`, `dist/wasm/vision_wasm_internal.wasm`, seven `/guqin/` samples and `dist/art/landscape.jpg` after a build; run it and confirm failure.
- [ ] Import `xianyang-s4` source, local assets and test scripts into `app/`; place `main/dist/art/` under `app/public/art/` and the seven strings under `app/public/guqin/`. Configure Vite `outDir: '../dist'`, `emptyOutDir: true`, and `base: '/'`.
- [ ] Update root preview server only as needed to serve SPA fallback and existing static assets with correct MIME types. Run build test and `npm --prefix app run test:all`; fix any path or import failures.
- [ ] Commit the import and build wiring without committing generated `dist/` binaries.

### Task 2: Session controller and durable record contract

**Files:** Create `app/src/session/trainingSession.js`, `app/src/session/trainingSession.test.mjs`; modify `app/src/stores/records.js`, `app/src/views/TrainView.vue`; test `app/src/stores/records.test.mjs`.

**Interfaces:** `createTrainingSession({ engineFactory, judgeFactory, audio, recordStore, clock })` returns `{ on(event, listener), start({ mode, deviceId }), pause(), resume(), stop({ reason }), dispose(), snapshot() }`. Events contain `{ type, stage, moveId, source, completedMoveIds, error }`. `recordStore.save({ moveIds, sources, startedAt, endedAt, tone })` returns the existing record shape and `recordStore.list()` returns newest first.

- [ ] Write failing tests for ordered loading/ready/hit/completed events, duplicate hit suppression, pause, permission rejection, stop during loading, dispose cleanup and one record for a partial session. Also test malformed/unavailable localStorage.
- [ ] Extract camera/pose/judge/guqin lifecycle from `TrainView.vue` into the controller, preserving the existing engine math and fallback behavior. Bind the existing training view to controller events and stable `moves.json` IDs.
- [ ] Run the focused tests, existing judge/audio/fallback suites and build; commit when all pass.

### Task 3: Rebuild the UI flow around the real session

**Files:** Create `app/src/views/LegacySplashView.vue`, `LegacyQuestionsView.vue`, `LegacyHomeView.vue`, `LegacySoundView.vue`, `LegacyIntroView.vue`, `LegacyFinishView.vue`, `LegacyProfileView.vue`, `LegacyBodyView.vue`; create `app/src/styles/legacy-ui.css`, `app/src/stores/profile.js`; modify `app/src/main.js`, `app/src/App.vue`, `app/src/views/TrainView.vue`; test `app/scripts/flow.test.mjs`.

**Interfaces:** Routes `/#/splash`, `/#/questions`, `/#/`, `/#/sound`, `/#/intro`, `/#/train`, `/#/finish`, `/#/me`, `/#/me/body-data`; `profile.load()` and `profile.save(value)` accept validated height, weight, age and preferences. Finish/profile views consume `recordStore.list()`.

- [ ] Write a failing flow test for first visit → questions → home → intro → training; camera denied → retry/manual route; move hits → finish; finish → profile showing the same record; refresh retaining data.
- [ ] Port the nine screens' layout, copy and art from `main/dist/app.js` and `app.css` into scoped Vue views/CSS. Wire every visible primary action to an actual route, preference, audio or session action; disable and explain any unavailable action.
- [ ] Render training status and camera failures from the session controller, and show manual move provenance in finish/profile. Run the flow test and build, then compare key screens against `main` at mobile width.
- [ ] Commit the UI flow.

### Task 4: Playback, lifecycle and release verification

**Files:** Modify `app/src/views/LegacySoundView.vue`, `app/src/views/TrainView.vue`, `app/src/session/trainingSession.js`, root `README.md`; create or modify `app/scripts/release-smoke.mjs`.

**Interfaces:** Sound view uses local playable tracks; route exit pauses and releases media. `release-smoke` checks static assets, server routes and the complete happy path against the built output.

- [ ] Write failing tests for audio blocked until user action, track change/route exit cleanup, and training route exit while the camera is loading.
- [ ] Implement playback cleanup and clear user-facing recovery states. Run `npm --prefix app run test:all`, `npm --prefix app run build`, build test and release smoke.
- [ ] Start the root preview server and inspect the full mobile flow in a browser, including permission rejection and refresh; record limits that require real camera/phone validation in README.
- [ ] Commit release fixes and documentation; verify the branch diff, then push `liaoyu0-1` and open a draft PR for review.

## Final acceptance

- [ ] The new UI is served from one Vue application, and `main`'s standalone `app.js` is absent from the generated `dist/index.html`.
- [ ] A real move hit emits one corresponding string, and move 8 completes the session with seven-string chord.
- [ ] Camera/model failure offers a working recovery path; leaving training releases resources.
- [ ] Finish and profile read the same persisted record after refresh.
- [ ] Build, focused tests, regression suites and browser flow pass; any real-device limitation is stated precisely.
