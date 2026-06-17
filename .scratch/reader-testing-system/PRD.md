# Reader Testing System PRD

Status: ready-for-agent

## Problem Statement

Eriri has a Tauri backend and React frontend but no first-class test runner, test strategy, or executable regression suite. Changes to catalog hydration, reading progress, scanning, tags, and persistence can regress without an automated signal.

## Solution

Add a staged testing system that starts with high-value behavior tests at stable public seams. The first stage introduces Vitest for frontend behavior, Rust unit/integration tests for backend behavior, local issue files for implementation slices, and documented commands for running the suite.

## User Stories

1. As a reader, I want my catalog to hydrate consistently, so that libraries, comics, authors, and books appear in predictable order.
2. As a reader, I want reading progress to be calculated consistently, so that reopening a comic or book resumes near the right place.
3. As a reader, I want favorite chapters to persist as a set of quick-return positions, so that toggling a favorite is reliable.
4. As a reader, I want tabs to behave predictably, so that opening and closing reading material does not lose the active tab unexpectedly.
5. As a reader, I want book parsing to detect chapter headings, so that chapter navigation stays useful.
6. As a maintainer, I want frontend tests to run with one command, so that reader regressions can be checked before release.
7. As a maintainer, I want backend persistence tests to run with Cargo, so that SQLite catalog and progress changes are protected.
8. As a maintainer, I want HTTP-facing adapters tested at the fetch boundary, so that request contracts are explicit without mocking internal modules.
9. As a maintainer, I want the test strategy documented, so that future tests follow the same behavior-first style.

## Implementation Decisions

- Use Vitest as the frontend test runner because the app already uses Vite and TypeScript.
- Use the frontend stores and API adapter modules as the primary React-side test seams.
- Use Cargo's built-in test runner for Rust backend tests.
- Use in-memory SQLite connections for backend persistence tests where possible.
- Use temporary files for scanner tests that need realistic filesystem behavior.
- Keep full Tauri launch tests out of the first stage.

## Testing Decisions

- Good tests verify observable behavior through public interfaces, not internal collaborator call order.
- Frontend tests may mock `fetch`, browser APIs, and time. They should not mock Eriri stores when testing store behavior.
- Rust tests should prefer module-level functions over HTTP handler internals unless the handler is the public seam being exercised.
- Initial coverage focuses on catalog, reading progress, tabs, and book parsing because those are high-value reader workflows.

## Out of Scope

- Browser-driven E2E coverage.
- Visual regression tests.
- CI provider configuration.
- Test coverage thresholds.

## Further Notes

The first-stage suite should be small but real: each test should protect an existing reader behavior and be runnable locally on a developer machine.
