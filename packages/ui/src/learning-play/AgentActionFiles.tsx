import type { RefObject } from "react";
import { GameToggle } from "@pieai/swimmer-ui-kit";
import type { AgentActionInspection, AgentFile, AgentTool } from "@pieai/university-core";
import { translate } from "../i18n/index.js";

interface AgentActionFilesProps {
  readonly inspection: AgentActionInspection;
  readonly files: readonly AgentFile[];
  readonly tool: AgentTool;
  readonly disabled: boolean;
  readonly guided?: boolean;
  readonly readConsent?: boolean;
  readonly headingRef: RefObject<HTMLHeadingElement | null>;
  readonly onToggleFile: (fileId: string) => void;
}

/** These switches edit the same capability map as the toolbox above the action. */
export function AgentActionFiles({
  inspection,
  files,
  tool,
  disabled,
  guided = false,
  readConsent = false,
  headingRef,
  onToggleFile,
}: AgentActionFilesProps) {
  const BeforeContent = guided ? "details" : "div";
  return (
    <section
      className="play-ai-agent__action-files"
      data-guided={guided}
      data-read-consent={readConsent}
    >
      <header>
        <h4 ref={headingRef} tabIndex={-1}>
          {translate(guided ? "play.ai.agent.guide.files" : "play.ai.agent.play.filesTitle", {
            tool: tool.label,
          })}
        </h4>
        {!guided ? (
          <>
            <p>{translate("play.ai.agent.play.usingTool", { tool: tool.label })}</p>
            <p>{translate("play.ai.agent.play.filesHint")}</p>
          </>
        ) : null}
      </header>
      {inspection.targets.map((target) => {
        const file = files.find((item) => item.id === target.fileId)!;
        const changesProtected = inspection.changedProtectedFileIds.includes(target.fileId);
        return (
          <article
            key={target.fileId}
            className="play-ai-agent__target-card"
            data-reachable={target.granted}
            data-protected={file.protected}
            data-risk={changesProtected}
          >
            <header>
              <div>
                <strong>{file.label}</strong>
                <code>{file.path}</code>
              </div>
              <span>
                {translate(
                  target.reads && target.writes
                    ? "play.ai.agent.play.readWriteTarget"
                    : target.writes
                      ? "play.ai.agent.play.writeTarget"
                      : "play.ai.agent.play.readTarget",
                )}
              </span>
            </header>
            <div className="play-ai-agent__target-scope">
              {readConsent ? (
                <p>{translate("play.ai.agent.guide.readOnly")}</p>
              ) : (
                <>
                  <GameToggle
                    checked={target.granted}
                    disabled={disabled}
                    label={translate("play.ai.agent.play.allowTarget", {
                      tool: tool.label,
                      file: file.label,
                    })}
                    onClick={() => onToggleFile(target.fileId)}
                  />
                  <p>
                    {translate(
                      guided
                        ? target.granted
                          ? "play.ai.agent.guide.allowed"
                          : target.required
                            ? "play.ai.agent.guide.required"
                            : "play.ai.agent.guide.kept"
                        : target.granted
                          ? "play.ai.agent.play.targetAllowed"
                          : target.required
                            ? "play.ai.agent.play.targetRequiredBlocked"
                            : "play.ai.agent.play.targetOptionalBlocked",
                    )}
                    {file.protected ? ` ${translate("play.ai.agent.protected")}` : ""}
                  </p>
                </>
              )}
            </div>
            <div className="play-ai-agent__target-contents" data-writes={target.writes}>
              <BeforeContent className="play-agent-before">
                {guided ? (
                  <summary>
                    {translate(
                      target.writes
                        ? "play.ai.agent.guide.before"
                        : "play.ai.agent.guide.readDetails",
                    )}
                  </summary>
                ) : null}
                <section>
                  {!guided ? (
                    <h5>
                      {translate(
                        target.writes
                          ? "play.ai.agent.play.before"
                          : "play.ai.agent.play.readContent",
                      )}
                    </h5>
                  ) : null}
                  <pre tabIndex={0}>
                    {target.beforeContent || translate("play.ai.agent.fileEmpty")}
                  </pre>
                </section>
              </BeforeContent>
              {target.writes ? (
                <section data-blocked={!target.granted}>
                  <h5>{translate("play.ai.agent.play.proposed")}</h5>
                  <pre tabIndex={0}>
                    {target.proposedContent || translate("play.ai.agent.fileEmpty")}
                  </pre>
                </section>
              ) : null}
            </div>
            {!guided && target.writes && !target.granted ? (
              <p className="play-ai-agent__target-outcome">
                {translate("play.ai.agent.play.effectPrevented")}
              </p>
            ) : changesProtected ? (
              <p className="play-ai-agent__target-outcome" data-risk={target.granted}>
                {translate("play.ai.agent.play.protectedReachable")}
              </p>
            ) : null}
          </article>
        );
      })}
      {!guided ? (
        <p className="play-ai-agent__target-check" data-ready={inspection.execution.accepted}>
          {translate(
            inspection.execution.accepted
              ? "play.ai.agent.play.engineReady"
              : "play.ai.agent.play.engineBlocked",
          )}
        </p>
      ) : null}
    </section>
  );
}
