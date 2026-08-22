import type { ReactNode } from "react";

/**
 * Personal archive. The 3D avatar is a slot: `packages/ui` stays at zero
 * `three`, so each app passes the canvas it actually has.
 *
 * Practice and review live under this tab on mobile, the way Duolingo buries
 * its practice hub in the profile tab. The links are here so a phone can
 * reach them without a rail.
 *
 * A 0 on this page is not a number, it is an invitation. The archive is
 * where the product builds identity, not where it audits the newcomer.
 * Show the count only once it is at least one; at zero, say what will grow
 * and point at the next lesson. The avatar stays first: it is the one
 * thing on this page that already belongs to them.
 */
export function ProfileScreen({
  avatar,
  account,
  passagesRead,
  lessonsCompleted,
  nextHref = "#/",
}: {
  readonly avatar?: ReactNode;
  /** Quiet account door. Absent when a shell has not wired identity yet. */
  readonly account?: ReactNode;
  readonly passagesRead: number;
  readonly lessonsCompleted: number;
  readonly nextHref?: string;
}) {
  return (
    <div className="profile-screen">
      <div className="profile-screen__hero">{avatar}</div>
      {account}
      <dl className="profile-screen__stats">
        <Stat
          label="读过真实代码"
          value={passagesRead}
          unit="段"
          invite="还没读过真实代码 —— 第一节里就有"
          href={nextHref}
        />
        <Stat
          label="学完"
          value={lessonsCompleted}
          unit="节"
          invite="还没学完一节 —— 从这里开始"
          href={nextHref}
        />
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

function Stat({
  label,
  value,
  unit,
  invite,
  href,
}: {
  readonly label: string;
  readonly value: number;
  readonly unit: string;
  readonly invite: string;
  readonly href: string;
}) {
  if (value >= 1) {
    return (
      <div>
        <dt>{label}</dt>
        <dd>
          {value} <span>{unit}</span>
        </dd>
      </div>
    );
  }
  return (
    <div className="profile-screen__stat--invite">
      <dt>{label}</dt>
      <dd className="profile-screen__invite">
        <a href={href}>{invite}</a>
      </dd>
    </div>
  );
}
