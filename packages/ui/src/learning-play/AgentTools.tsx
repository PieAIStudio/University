import type { RefObject } from "react";
import { GameButton, GameToggle } from "@pieai/swimmer-ui-kit";
import type { AgentActivity, AgentState } from "@pieai/university-core";
import { translate } from "../i18n/index.js";

export function AgentTools({
  activity,
  capabilities,
  currentToolId,
  disabled,
  headingRefs,
  onGrant,
}: {
  readonly activity: AgentActivity;
  readonly capabilities: AgentState["capabilities"];
  readonly currentToolId?: string;
  readonly disabled: boolean;
  readonly headingRefs: RefObject<Map<string, HTMLElement>>;
  readonly onGrant: (toolId: string, fileIds: readonly string[]) => void;
}) {
  const paths = (ids: readonly string[]) =>
    ids.map((id) => activity.files.find((file) => file.id === id)?.path ?? id).join(" · ");
  return (
    <section className="play-ai-agent__tools">
      <h4>{translate("play.ai.agent.toolbox")}</h4>
      <p className="play-ai-workflow__note">{translate("play.ai.agent.scopeHelp")}</p>
      <div className="play-ai-agent__tool-list">
        {activity.tools.map((tool) => {
          const grants = capabilities[tool.id] ?? [];
          const isTaskScope =
            grants.length === tool.taskFileIds.length &&
            tool.taskFileIds.every((id) => grants.includes(id));
          return (
            <details key={tool.id} className="play-ai-agent__tool" open={currentToolId === tool.id}>
              <summary
                ref={(node) => {
                  if (node) headingRefs.current.set(tool.id, node);
                  else headingRefs.current.delete(tool.id);
                }}
              >
                <span
                  aria-hidden="true"
                  className="play-ai-agent__tool-light"
                  data-enabled={grants.length > 0}
                />
                <strong>{tool.label}</strong>
                <span>{grants.length ? grants.length : "—"}</span>
              </summary>
              <p>{tool.description}</p>
              <div className="play-ai-agent__scope" role="group" aria-label={tool.label}>
                <GameButton
                  variant={grants.length === 0 ? "primary" : "secondary"}
                  sound={false}
                  disabled={disabled}
                  aria-pressed={grants.length === 0}
                  onClick={() => onGrant(tool.id, [])}
                >
                  {translate("play.ai.agent.grantOff")}
                </GameButton>
                <GameButton
                  variant={isTaskScope ? "primary" : "secondary"}
                  sound={false}
                  disabled={disabled}
                  aria-pressed={isTaskScope}
                  onClick={() => onGrant(tool.id, tool.taskFileIds)}
                >
                  {translate("play.ai.agent.grantTask")}
                </GameButton>
                <GameButton
                  variant={grants.length === activity.files.length ? "primary" : "secondary"}
                  sound={false}
                  disabled={disabled}
                  aria-pressed={grants.length === activity.files.length}
                  onClick={() =>
                    onGrant(
                      tool.id,
                      activity.files.map((file) => file.id),
                    )
                  }
                >
                  {translate("play.ai.agent.grantAll")}
                </GameButton>
              </div>
              <p className="play-ai-agent__grant-paths">
                {grants.length
                  ? translate("play.ai.agent.grants", { paths: paths(grants) })
                  : translate("play.ai.agent.noAccess")}
              </p>
              <details className="play-ai-agent__custom-scope">
                <summary>{translate("play.ai.agent.chooseFiles")}</summary>
                {activity.files.map((file) => (
                  <GameToggle
                    key={file.id}
                    checked={grants.includes(file.id)}
                    disabled={disabled}
                    label={`${tool.label} · ${file.path}`}
                    onClick={() =>
                      onGrant(
                        tool.id,
                        grants.includes(file.id)
                          ? grants.filter((id) => id !== file.id)
                          : [...grants, file.id],
                      )
                    }
                  />
                ))}
              </details>
            </details>
          );
        })}
      </div>
    </section>
  );
}
