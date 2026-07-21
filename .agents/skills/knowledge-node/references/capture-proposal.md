# Capture Proposal Reference

Use this shape for `.scratch/captures/<capture-id-safe-name>.json`:

```json
{
  "note": {
    "schemaVersion": 1,
    "id": "auth-state-boundary",
    "title": "认证状态边界",
    "question": "认证状态为什么必须由会话模块统一管理？",
    "summary": "一句话答案",
    "claimType": "source-fact",
    "status": "active",
    "contentRevision": 1,
    "tags": ["architecture", "auth"],
    "evidence": [{
      "kind": "fact",
      "snapshotId": "snapshot-id",
      "sourceCommit": "40-character-commit",
      "sourcePath": "src/auth/session.ts",
      "lineStart": 10,
      "lineEnd": 28
    }],
    "origin": {
      "kind": "ai-conversation",
      "host": "grok-build",
      "capturedAt": "2026-07-20T12:00:00.000Z",
      "sessionId": "optional-open-session-id",
      "captureId": "grok:session-or-date:auth-state-boundary-v1"
    },
    "cards": [{
      "id": "auth-state-owner",
      "kind": "basic",
      "front": "认证状态应由哪个边界负责？为什么？",
      "back": "最小充分答案",
      "tags": ["architecture", "auth"]
    }],
    "createdAt": "2026-07-20T12:00:00.000Z",
    "updatedAt": "2026-07-20T12:00:00.000Z"
  },
  "content": "# 认证状态边界\n\n重新组织后的教学内容。"
}
```

Omit `contentHash`; UniversityLocal computes it. Keep timestamps and IDs stable across retries. For revisions, keep `id` and `createdAt`, increment `contentRevision`, update `updatedAt`, and use a new `captureId` only for the new revision.
