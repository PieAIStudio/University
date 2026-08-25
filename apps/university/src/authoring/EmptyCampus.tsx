import { GamePanel } from "@pieai/swimmer-ui-kit";

export function EmptyCampus() {
  return (
    <GamePanel className="empty-state" tone="strong">
      <span className="empty-state__mark" aria-hidden="true">
        U
      </span>
      <div>
        <h2>第一项学习还没有准备好。</h2>
        <p>用 AI 宿主注册一个真实项目后，它会出现在这里；源码不会被学习资料污染。</p>
      </div>
    </GamePanel>
  );
}
