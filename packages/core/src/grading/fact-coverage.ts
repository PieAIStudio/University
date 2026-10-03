/** Both AI-source ports enforce this rule before granting completion credit. */
export function requiredFactCoverage(
  facts: readonly {
    criterion: number;
    from: "answer" | "request" | "missing";
    quote: string;
  }[],
  criterionCount: number,
  answer: string,
  request = "",
): "complete" | "missing" | "invalid" {
  if (
    !facts.length ||
    Array.from({ length: criterionCount }, (_, index) => index).some(
      (criterion) => !facts.some((fact) => fact.criterion === criterion),
    ) ||
    facts.some(
      (fact) =>
        fact.criterion < 0 ||
        fact.criterion >= criterionCount ||
        (fact.from === "missing"
          ? fact.quote !== ""
          : !fact.quote.trim() ||
            !(fact.from === "answer" ? answer : request).includes(fact.quote)),
    )
  )
    return "invalid";
  return facts.some((fact) => fact.from === "missing") ? "missing" : "complete";
}
