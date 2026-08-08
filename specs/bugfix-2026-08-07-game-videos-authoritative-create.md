# BUGFIX: Authoritative game video creation

> **Status:** `IMPLEMENTED`
> **Severity:** `HIGH`
> **Author:** Codex
> **Date:** 2026-08-07
> **Issue:** #4024
> **Related spec:** `feat-2026-07-04-game-videos.md`

## 1. Requirements

- A client must not create an authoritative `game_videos` document directly.
- A video document may be created only after the authenticated uploader owns the
  canonical Storage path and the object exists.
- The server must enforce the finished-game, participant/manager, size, MIME,
  and per-game/per-user limits.
- The URL stored in Firestore must be derived from Storage metadata, never from
  a client URL.
- Web must not render a client-controlled URL while a video is PROCESSING.
- Existing reads, reactions, and authorized deletes must remain functional.
- Web and Android upload flows must use the callable.

## 2. Technical Design

- Add `createGameVideo` using the repository `secureCallable` wrapper.
- Use a deterministic document ID based on the Storage path for idempotency.
- Recheck authorization and active-video limits inside a Firestore transaction.
- Add the required composite index for active-video queries.
- Deny direct Firestore creates after client migration.
- Keep the Storage finalization trigger as the processor and validator.

## 3. Acceptance Criteria

- Anonymous, non-participant, unfinished-game, invalid-path, missing-object,
  invalid-MIME, oversized, and over-limit requests fail without creating a doc.
- Repeating the same callable request does not create a duplicate document.
- A valid request creates one PROCESSING document with a server-derived URL.
- PROCESSING videos are represented by a status placeholder on Web.
- Rules tests, Functions tests, Web typecheck/tests, and Android compile pass.

## 4. Tasks

1. Add callable validation, idempotent transaction, URL derivation, and export.
2. Update Firestore rules and indexes; adjust rules tests for server-only create.
3. Migrate Web and Android upload clients to the callable.
4. Add regression tests for callable, query pagination/index, and PROCESSING URL
   rendering.
5. Run all relevant verification commands.

## 5. Verify

- [x] Functions build and lint pass.
- [x] Functions tests pass.
- [x] Firestore rules tests pass.
- [x] Web typecheck, tests, and build pass.
- [x] Android Kotlin compile and relevant unit tests pass.
