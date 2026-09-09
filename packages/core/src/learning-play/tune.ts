import type { NumericExpression, TuneActivity } from "./types.js";

/** Small arithmetic tree, no source-code execution and bounded recursion. */
export function evaluateExpression(
  expression: NumericExpression,
  values: Readonly<Record<string, number>>,
  depth = 0,
): number {
  if (depth > 16) throw new Error("Expression exceeds the activity depth limit");
  if (typeof expression === "number") return expression;
  if ("control" in expression) return values[expression.control] ?? Number.NaN;
  if (expression.args.length === 0 || expression.args.length > 32) return Number.NaN;
  const terms = expression.args.map((term) => evaluateExpression(term, values, depth + 1));
  switch (expression.op) {
    case "sum":
      return terms.reduce((sum, value) => sum + value, 0);
    case "product":
      return terms.reduce((product, value) => product * value, 1);
    case "min":
      return Math.min(...terms);
    case "max":
      return Math.max(...terms);
  }
}

export function evaluateTuning(activity: TuneActivity, values: Readonly<Record<string, number>>) {
  const validInput = activity.controls.every((control) => {
    const value = values[control.id];
    return (
      value !== undefined && Number.isFinite(value) && value >= control.min && value <= control.max
    );
  });
  const metrics = activity.metrics.map((metric) => {
    const value = evaluateExpression(metric.expression, values);
    return {
      id: metric.id,
      value,
      passed:
        Number.isFinite(value) &&
        (metric.min === undefined || value + 1e-9 >= metric.min) &&
        (metric.max === undefined || value - 1e-9 <= metric.max),
    };
  });
  return {
    validInput,
    passed: validInput && metrics.length > 0 && metrics.every((metric) => metric.passed),
    metrics,
  };
}
