export type PreviewFailureCode =
  | "unavailable"
  | "timeout"
  | "cancelled"
  | "busy"
  | "rejected"
  | "quota"
  | "stale";
export class PreviewFailure extends Error {
  constructor(
    readonly code: PreviewFailureCode,
    readonly status = 400,
  ) {
    super(code);
  }
}
export function safeFailure(error: unknown): PreviewFailure {
  return error instanceof PreviewFailure ? error : new PreviewFailure("unavailable", 503);
}
