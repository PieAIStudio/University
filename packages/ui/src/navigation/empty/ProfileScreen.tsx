import type { ReactNode } from "react";

/**
 * Personal archive. The 3D avatar is a slot: `packages/ui` stays at zero
 * `three`, so each app passes the canvas it actually has.
 *
 * Practice and review live under this tab on mobile, the way Duolingo buries
 * its practice hub in the profile tab. The links are here so a phone can
 * reach them without a rail.
 */
export function ProfileScreen({
  avatar,
  passagesRead,
  lessonsCompleted,
}: {
  readonly avatar?: ReactNode;
  readonly passagesRead: number;
  readonly lessonsCompleted: number;
}) {
  return (
    <div className="profile-screen">
      <div className="profile-screen__hero">{avatar}</div>
      <dl className="profile-screen__stats">
        <div>
          <dt>读过真实代码</dt>
          <dd>
            {passagesRead} <span>段</span>
          </dd>
        </div>
        <div>
          <dt>学完</dt>
          <dd>
            {lessonsCompleted} <span>节</span>
          </dd>
        </div>
      </dl>
      <section className="profile-screen__badges" aria-label="徽章墙">
        <h2>徽章墙</h2>
        <p>徽章还没开张。学完的课会记在上面。</p>
        <ul>
          {Array.from({ length: 5 }, (_, index) => (
            <li key={index} aria-hidden="true" />
          ))}
        </ul>
      </section>
      <div className="profile-screen__links">
        <a href="#/practice">练习</a>
        <a href="#/review">复习</a>
        <a href="#/settings">设置</a>
      </div>
    </div>
  );
}
