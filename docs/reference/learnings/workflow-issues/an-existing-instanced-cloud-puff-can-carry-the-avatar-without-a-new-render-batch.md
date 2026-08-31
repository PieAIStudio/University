---
id: REF-LEARNING-WORKFLOW-ISSUES-AN-EXISTING-INSTANCED-CLOUD-PUFF-CAN-CARRY-THE-AVATAR-WITHOUT-A-NEW-RENDER-BATCH
title: "An existing instanced cloud puff can carry the avatar without a new render batch"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-08-31
last_reviewed: 2026-08-31
domain: learning
tags:
  - learning-recall
  - workflow-issues
pinned: false
related: []
category: workflow-issues
module: "PGS learning capture"
capture_mode: pgs-native
---

# An existing instanced cloud puff can carry the avatar without a new render batch

## Guidance

When a map already owns a deterministic InstancedMesh cloud sea, reserve one authored puff as the carrier slot and rewrite only its existing matrices in place with a shared Object3D scratch while reusing the existing hopPose and cancelling the parent drift. Keep the avatar feet target 1.55 world units above the puff centre. This preserves the cloud sea's two batches and authored puff counts, avoiding a new cloud draw call or pass. Verify the claim with renderer call/triangle counts and a visible headed-Chrome requestAnimationFrame sample; screenshots or hidden tabs are not frame evidence. Apply this pattern when avatar travel must span multiple map heights without adding a second animation system.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
