import { translate } from "@pieai/university-ui/i18n.js";
/**
 * Which campus this build is.
 *
 * A build-time constant, never a runtime object. `import.meta.env.MODE` is
 * replaced by a literal string before Rollup runs, so `AUTHORING` folds to
 * `true` or `false` and everything behind the false branch — `src/authoring/`
 * and every port that talks to a loopback server — is dropped from the bundle.
 * A capabilities object passed in at start-up would read the same in this file
 * and ship the whole authoring campus to every customer.
 *
 * `vite --mode authoring` and `vite --mode delivery` are therefore not two
 * configs. They are one app told which half of itself to keep.
 *
 * Not `--mode local`, which is what the two campuses are called in Chinese and
 * the obvious name to reach for. Vite refuses it: `.env.local` is its
 * always-loaded override file, so a mode by that name collides with it and
 * `vite build --mode local` stops with an error. Measured, not guessed — the
 * dev server accepts it and only the build refuses, which is the worst place
 * to find out.
 *
 * Under Vitest the mode is `test`, so a unit test gets the delivery ports.
 * Anything that needs the authoring ones stubs the port module, which is also
 * the honest thing to do: the authoring build talks to a server on 4317.
 */
export const AUTHORING = import.meta.env.MODE === "authoring";

/** The word a person uses for this build, for the feedback note and the title. */
export const CAMPUS_NAME = AUTHORING
  ? translate("app.mode.copy.本地端")
  : translate("app.mode.copy.在线端");

/**
 * What to do about an empty shelf, which is genuinely two different answers.
 *
 * A delivery build with no courses has not run its import; an authoring build
 * with no courses has no project registered yet. Both are one sentence, and a
 * build-time constant is the honest way to hold two sentences without holding
 * two screens.
 */
export const EMPTY_SHELF_HINT = AUTHORING
  ? translate("app.mode.copy.用-AI-宿主注册一个真实项目后-它会出现在这里-源码不会被学习资料污染")
  : translate(
      "app.mode.copy.先跑-pnpm-content-它会从-UniversityLocal-的导出包里取课程-没有-Universi",
    );
