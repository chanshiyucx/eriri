# Cover Backend Persistence And Scanning

Status: ready-for-agent

## Goal

Add Rust tests for backend reader behavior that can run without launching the Tauri app.

## Acceptance Criteria

- Progress persistence can upsert, delete, and snapshot comic/book progress.
- Favorite chapters persist in sorted order and replace previous values.
- Catalog rows persist and are returned in library order.
- Book parsing ignores blank lines and detects chapter headings.

## Comments
