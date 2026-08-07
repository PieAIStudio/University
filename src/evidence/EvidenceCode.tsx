import type { EvidenceSnippetView, EvidenceToken } from "../view/lesson-view.js";

function trustedThemeColor(color: string | undefined): string | undefined {
  return color && /^#[a-f0-9]{6}(?:[a-f0-9]{2})?$/i.test(color) ? color : undefined;
}

export function EvidenceCode({
  snippet,
  lines,
}: {
  readonly snippet: EvidenceSnippetView;
  readonly lines: readonly (readonly EvidenceToken[])[];
}) {
  return (
    <pre
      className="evidence-code"
      tabIndex={0}
      aria-label={`${snippet.sourcePath} 第 ${snippet.startLine} 到 ${snippet.endLine} 行`}
    >
      <code>
        {lines.map((tokens, index) => {
          const lineNumber = snippet.startLine + index;
          const highlighted =
            snippet.highlightStartLine !== null &&
            snippet.highlightEndLine !== null &&
            lineNumber >= snippet.highlightStartLine &&
            lineNumber <= snippet.highlightEndLine;
          return (
            <span
              className={`evidence-code__line${highlighted ? " evidence-code__line--highlighted" : ""}`}
              key={lineNumber}
            >
              <span className="evidence-code__line-number" aria-hidden="true">
                {lineNumber}
              </span>
              <span className="evidence-code__line-content">
                {tokens.map((token, tokenIndex) => (
                  <span
                    key={`${tokenIndex}:${token.content.length}`}
                    style={{ color: trustedThemeColor(token.color) }}
                  >
                    {token.content}
                  </span>
                ))}
              </span>
            </span>
          );
        })}
      </code>
    </pre>
  );
}
