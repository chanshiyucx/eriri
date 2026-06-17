# Add Frontend Test Runner

Status: ready-for-agent

## Goal

Introduce Vitest-based frontend testing that matches the Vite/React/TypeScript stack.

## Acceptance Criteria

- `pnpm test`, `pnpm test:run`, and `pnpm test:coverage` scripts exist.
- Vitest resolves the `@/` alias.
- Test setup handles browser globals used by stores.
- A minimal frontend test can run in a clean command.

## Comments
