import ReactMarkdown from "react-markdown";

/** Readable AI output using the installed Markdown parser, without the authored
 * lesson renderer's media/directives. The original string remains the evidence,
 * editable artifact and clipboard source; this only changes its presentation. */
export function PrimmResultText({ text }: { readonly text: string }) {
  return (
    <div className="primm__formatted">
      <ReactMarkdown
        skipHtml
        unwrapDisallowed
        allowedElements={[
          "p",
          "strong",
          "em",
          "ul",
          "ol",
          "li",
          "code",
          "pre",
          "blockquote",
          "br",
          "a",
        ]}
        urlTransform={(url) => (/^https?:\/\//i.test(url) ? url : "")}
        components={{
          a: ({ href, children }) =>
            href ? (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ) : (
              <span>{children}</span>
            ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
