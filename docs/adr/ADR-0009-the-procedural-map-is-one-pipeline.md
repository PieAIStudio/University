---
id: ADR-0009
title: The Procedural Map Is One Pipeline, Not Three Scenes
type: decision
status: accepted
canonical: true
owner: human
created: 2026-08-28
last_reviewed: 2026-08-28
domain: architecture
tags:
  - 3d
  - procedural
  - budget
pinned: false
related:
  - ADR-0004
  - ADR-0008
  - SPEC-0001
supersedes: []
superseded_by: null
---

# ADR-0009: The Procedural Map Is One Pipeline, Not Three Scenes

## Context

The product has three 3D surfaces: a planet where a learner picks a study, an
archipelago where they pick a course, and an island where they walk a course's
lessons. They were built as three scenes, and every one of them independently
re-answered the same questions — where does terrain come from, where does
colour come from, how much geometry may this cost, who decides.

That is why the same argument kept happening in three places, and why the
island read as noise. Inside the island alone, three systems were each drawing
from their own random field:

- ground colour, from three sine waves in `colorForTop()`
- grass density, from a separate grid-interpolated value noise
- decoration placement, from uniform random scatter that read neither

Measured against the real 41-lesson `foundations-before-zero` blueprint across
7,949 in-island sample points, the correlation between the ground-colour field
and the grass-density field was **r = 0.31**. The two were very nearly
independent. About a third of the island's area had the terrain painted green
where no grass grew, or grass standing on ground painted as bare rock. No
amount of tuning any one of them fixes that, because the disagreement is
structural.

The commercial requirement makes this worse rather than better. The author
writes a course; the island, the archipelago node and the planet cluster must
then generate themselves, with no per-island hand tuning, because there is no
level editor and there is not going to be one. Three scenes that each invent
their own answer cannot deliver that.

## Decision

The procedural map is **one pipeline with four stages**, and every 3D surface
is a projection of it rather than a scene of its own.

### 1. Blueprint — what the world *is*

`IslandBlueprint` is pure data derived from course content: route, outline,
terrain parameters, seed, theme slots. No geometry, no colour, no three.js. It
is the only thing authored content directly determines.

### 2. Field — the single source of truth

`IslandField` compiles the blueprint into one cached raster: a height grid plus
mask channels for route, meadow, shore and rock, plus baked AO. Grass,
dressing, terrain colour and landmark placement all **read this one field**.

This is the load-bearing rule. A system that needs to know "is this point
grass" asks the field. It does not roll its own noise. The r = 0.31 above is
what a second opinion costs.

### 3. Three projections — budget spent by screen pixels, not world size

The same field is drawn three ways, and each way gets its budget from **how
many pixels the element actually occupies**, not from how big it is in world
space:

- **Course** — the low camera, close to the learner. This is where triangles
  belong, because this is where a triangle is more than one pixel wide.
- **World** — an island is about 40px across. It gets a silhouette, one value
  break, and one bright pixel. Nothing else is legible at that size.
- **Planet** — study clusters float in the atmosphere above the surface. They
  are read as identity and position, not as terrain.

This principle has already killed real work in both directions. A 569-line
mechanical underside chassis was discarded because the underside it detailed is
~8px tall in the projection that draws it. The course camera was brought down
to 68 degrees for the opposite reason: the things near the learner had been
paying for detail nobody could see on things far from them.

### 4. Style — the one file a non-programmer touches

`IslandStyle` holds colour, texture groups, and sun/sky. It is the artist-facing
surface. Changing how the map looks should not require reading a renderer.

### And the technique lock, which is the fifth piece

ADR-0008 governs the orthogonal question: *what technique draws each element*.
This ADR governs where data comes from and how much it may cost. They compose —
the lock says "grass is one billboard card", this pipeline says "and it reads
its density from the field, and it spends its budget at the course projection".

## Consequences

- A new visual feature starts by asking which stage it belongs to. Something
  that generates its own noise field is a defect in stage 2, whatever it looks
  like.
- "Make it look better" is answered per projection, with the pixel budget
  stated. A change that helps the course view and costs the world view is not
  an improvement; it is a projection error.
- Per-island hand tuning stays impossible on purpose. If a specific island
  needs a fix, the fix goes into the blueprint rule or the style table, so every
  island generated after it gets the same benefit.
- `AGENTS.md`'s 3D routing row points here alongside ADR-0008, so a session
  reaches the pipeline before it reaches a renderer file.
- Stage 4 is the least finished. `IslandStyle` exists but colour decisions still
  leak into renderer files. That is the next structural debt, and it is named
  here so it is not rediscovered as a surprise.
