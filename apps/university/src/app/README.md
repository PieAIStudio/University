# apps/university/src/app

The composition of the one learner app. `composition/App.tsx` decides which screen is up,
mounts the one world stage, and wires features to each other. Everything that
has its own state, effects or rules lives in a file of its own here, in
`packages/*`, or behind a port in `../ports/`.

## The rule for App.tsx

App.tsx keeps only what ties two features together: the route, the stage, the
shell and the props that pass between them. A behaviour with its own state and
effects gets a `use-*.ts` hook beside it; a projection with no React gets a
plain function. If a block in App.tsx needs a comment to say what it is, it
probably wants a file and a name instead.

## Where things are

**Composition and routes**

| File                                                      | What it owns                                                 |
| --------------------------------------------------------- | ------------------------------------------------------------ |
| `composition/App.tsx`                                     | The composition: route → shell, stage and screen.            |
| `composition/MainRouter.tsx`                              | Which screen renders for a view, and the props each needs.   |
| `composition/use-route.ts`, `composition/shell-route.tsx` | The address a build can answer; the layout a route asks for. |
| `composition/page-metadata.ts`                            | The document head, kept in step with the route and shelf.    |

**What the screens read**

| File                                                                                       | What it owns                                                           |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `learner/use-shelf.ts`                                                                     | The courses on offer, once, and each course's shape by address.        |
| `state/course-progress.ts`, `state/course-completion-revision.ts`                          | How far each course got; when a map must re-read it.                   |
| `state/study-context.ts`, `state/navigation-focus.ts`                                      | Which study the learner is looking at (tab-local, never account data). |
| `learner/today-data.ts`, `learner/today-section-data.ts`                                   | The 「今天」 panel: next lesson, due cards, vocabulary.                |
| `learner/profile-stats.ts`, `learner/mistake-summary.ts`, `learner/use-knowledge-album.ts` | Projections for Me, the mistake list and the album.                    |

**The map and the stage**

| File                                                    | What it owns                                                              |
| ------------------------------------------------------- | ------------------------------------------------------------------------- |
| `map/world-model.ts`                                    | The archipelago and course placements, labels and path cards.             |
| `map/scene-camera.ts`, `map/scene-interaction.ts`       | The first shot of each map; stage readiness and recovery.                 |
| `map/map-arrival.ts`                                    | What happens once the map has arrived: framing a stone, the return offer. |
| `map/use-course-avatar-target.ts`                       | The stone or node the avatar walks to on a course.                        |
| `map/use-planet-choice.ts`, `map/map-domain-catalog.ts` | What the learner browses on the planet.                                   |
| `map/MapInformation.tsx`, `map/map-labels.ts`           | The map's information panel and an island's caption.                      |
| `map/MapQuickActions.tsx`, `map/map-keyboard.ts`        | The Space palette, its directory and commands; which keys the map owns.   |
| `map/MapBreadcrumbs.tsx`, `map/map-controls.tsx`        | The map's ancestry; which routes keep the world behind them.              |
| `map/CourseIsland.tsx`, `map/course-path-actions.ts`    | The course route questionnaire and its path actions.                      |
| `map/presence-anchors.ts`                               | Where companions see this learner and where they can stand.               |
| `map/island-look-view.ts`                               | DEV only: the island look judge's route, scene source and fixed camera.   |

**V7 journey moments**

| File                                                                                  | What it owns                                                           |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `journey/use-journey.tsx`                                                             | 涟's product moments on the map, including 「用了吗？」.               |
| `journey/use-chest-opening.tsx`                                                       | A finished lesson's chest on its island, and the keepsake it may drop. |
| `journey/use-weekly-boss.tsx`                                                         | This week's boss on the island you are looking at.                     |
| `journey/use-welcome.ts`, `journey/welcome-policy.ts`, `journey/use-first-meeting.ts` | The first arrival: the two paths and the tour to the first stone.      |
| `journey/OpeningSplash.tsx`, `journey/splash-policy.ts`                               | App-launch admission and its measured progress.                        |
| `journey/use-local-day.ts`                                                            | One local calendar clock for screens that change at midnight.          |

**The learner and the account**

| File                                                         | What it owns                                                  |
| ------------------------------------------------------------ | ------------------------------------------------------------- |
| `learner/LearnerAvatarPanel.tsx`                             | The avatar panel on the rail, in the phone dialog and on Me.  |
| `learner/ProfileAvatar.tsx`, `learner/avatar-preferences.ts` | The avatar preview; the recipe saved to the account.          |
| `learner/analytics-ports.ts`, `learner/route-analytics.ts`   | Analytics at the app boundary; one event per arrival.         |
| `learner/feedback-context.ts`                                | What a feedback note is about.                                |
| `learner/DomainInterest.tsx`                                 | A consented interest record for a domain with no courses yet. |

The learner's house lives in `../house/store.ts` (the app's side) with its rules
in `@pieai/university-core` and its room in `@pieai/university-ui/house`.
