/**
 * Day-zero placeholder.
 *
 * This file exists so that `typecheck`, `lint`, `format:check`, `test` and
 * `build` are real gates from the first commit rather than empty ceremony. It
 * is deliberately DOM-only: the moment a `<Canvas>` appears, Web3D capability
 * baseline rules 1-5 (single renderer owner, one sRGB encode, a named grade,
 * a DPR clamp, an audio unlock latch) become live obligations, and those are
 * design decisions this project has not made yet. The portfolio manifest
 * records that as a `scheduled-migration` exception, not as a pass.
 *
 * The session that writes the first 3D scene owns removing this file and
 * satisfying those rules in the same change.
 */
export function App() {
  return (
    <main className="placeholder">
      <h1>University</h1>
      <p>
        设计阶段。用户旅程 V1 在 <code>docs/reference/player-journey/v1/index.html</code>。
      </p>
      <p>
        课程与功能的一致性契约在{" "}
        <code>docs/specs/active/SPEC-0001-universitylocal-parity-contract.md</code>。
      </p>
    </main>
  );
}
