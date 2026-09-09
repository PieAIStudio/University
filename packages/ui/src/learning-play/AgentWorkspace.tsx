import { GameButton } from "@pieai/swimmer-ui-kit";
import type { AgentFile } from "@pieai/university-core";
import { translate } from "../i18n/index.js";

export function AgentWorkspace({
  files,
  activeFileId,
  changedProtectedFileIds,
  onSelect,
  onNext,
}: {
  readonly files: readonly AgentFile[];
  readonly activeFileId: string;
  readonly changedProtectedFileIds: readonly string[];
  readonly onSelect: (fileId: string) => void;
  readonly onNext?: () => void;
}) {
  const activeFile = files.find((file) => file.id === activeFileId);
  return (
    <section className="play-ai-agent__workspace">
      <h4>{translate("play.ai.agent.workspace")}</h4>
      <div
        className="play-ai-agent__file-tabs"
        role="group"
        aria-label={translate("play.ai.agent.workspace")}
      >
        {files.map((file) => (
          <GameButton
            key={file.id}
            variant={file.id === activeFileId ? "primary" : "ghost"}
            aria-pressed={file.id === activeFileId}
            sound={false}
            onClick={() => {
              onSelect(file.id);
            }}
          >
            {file.label}
            {changedProtectedFileIds.includes(file.id) ? " !" : ""}
          </GameButton>
        ))}
      </div>
      {activeFile ? (
        <article
          className="play-ai-agent__file"
          data-damaged={changedProtectedFileIds.includes(activeFile.id)}
        >
          <header>
            <code>{activeFile.path}</code>
            <span>
              {translate(
                changedProtectedFileIds.includes(activeFile.id)
                  ? "play.ai.agent.changed"
                  : activeFile.protected
                    ? "play.ai.agent.protected"
                    : "play.ai.agent.editable",
              )}
            </span>
          </header>
          <pre>{activeFile.content || translate("play.ai.agent.fileEmpty")}</pre>
        </article>
      ) : null}
      {onNext ? (
        <GameButton variant="ghost" sound={false} onClick={onNext}>
          {translate("play.ai.agent.nextAction")}
        </GameButton>
      ) : null}
    </section>
  );
}
