import type { ActivityKind } from "@pieai/university-core";

/** Diagram symbols, kept in one stroke family. No external image or font fetch. */
export function PlayIcon({
  name,
  className = "",
}: {
  readonly name: ActivityKind | "check" | "arrow" | "spark";
  readonly className?: string;
}) {
  const paths: Record<typeof name, string> = {
    connect:
      "M6 8V5h12v3M6 16v3h12v-3M6 11v2M18 11v2M3 8h6v3H3zM15 8h6v3h-6zM3 13h6v3H3zM15 13h6v3h-6z",
    tune: "M5 3v6m0 4v8M12 3v11m0 4v3M19 3v3m0 4v11M2 9h6v4H2zM9 14h6v4H9zM16 6h6v4h-6z",
    hunt: "M15 15l6 6M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0M7 10h6M10 7v6",
    dispatch: "M3 12h6m0 0 4-7h8M9 12h12M9 12l4 7h8M18 2l3 3-3 3M18 9l3 3-3 3M18 16l3 3-3 3",
    program: "M5 5h9a4 4 0 0 1 0 8H6a4 4 0 0 0 0 8h13M16 18l3 3-3 3M2 2h6v6H2z",
    "ai-brief": "M4 3h16v18H4zM8 7h8M8 11h5M8 15h3M14 15l2 2 4-5",
    "ai-context": "M3 7h7l2 2h9v12H3zM6 3h11v6M6 13h12M6 17h8",
    "ai-agent": "M8 5h8v4H8zM5 12h14v8H5zM12 9v3M8 16h1M15 16h1M2 14v4M22 14v4",
    "ai-eval": "M4 3h16v18H4zM8 7h1M12 7h5M8 12h1M12 12h5M8 17l2 2 4-5",
    "ai-repair": "M4 9a8 8 0 1 1-1 7M4 3v6h6M12 7v5l4 2",
    check: "M5 12l4 4L19 6",
    arrow: "M4 12h16m-6-6 6 6-6 6",
    spark: "M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z",
  };
  return (
    <svg
      className={`play-icon ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
