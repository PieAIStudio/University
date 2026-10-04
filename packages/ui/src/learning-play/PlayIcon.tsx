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
    // Two trays and a thing on its way into one of them.
    sort: "M3 14h7v6H3zM14 14h7v6h-7zM10 6h4v4h-4zM12 10v3m0 0-2-2m2 2 2-2",
    // Two columns fed the same thing: one line splits, the other lands together.
    // A balance whose two pans are not level, and a pivot that can move.
    tune: "M5 3v6m0 4v8M12 3v11m0 4v3M19 3v3m0 4v11M2 9h6v4H2zM9 14h6v4H9zM16 6h6v4h-6z",
    primm: "M4 5h4v4H4zM16 15h4v4h-4zM8 7h8v6M16 11l2 2 2-2",
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
