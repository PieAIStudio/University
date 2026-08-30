import { describe, expect, it, vi } from "vitest";

import {
  createConsoleLocaleDemandPort,
  languageCodeOf,
  recordLocaleRequest,
} from "./locale-demand";

describe("locale demand measurement", () => {
  it("records only the language subtag", () => {
    const record = vi.fn();
    const port = { record };

    expect(recordLocaleRequest(port, "ar-EG")).toEqual({
      event: "university.locale.requested",
      schemaVersion: 1,
      languageCode: "ar",
    });
    expect(record).toHaveBeenCalledWith({
      event: "university.locale.requested",
      schemaVersion: 1,
      languageCode: "ar",
    });
  });

  it("does not record malformed or missing browser locales", () => {
    expect(languageCodeOf(undefined)).toBeNull();
    expect(languageCodeOf("not a locale")).toBeNull();
    const record = vi.fn();
    expect(recordLocaleRequest({ record }, null)).toBeNull();
    expect(record).not.toHaveBeenCalled();
  });

  it("has a structured-log adapter with no extra fields", () => {
    const write = vi.fn();
    const port = createConsoleLocaleDemandPort(write);
    port.record({
      event: "university.locale.requested",
      schemaVersion: 1,
      languageCode: "zh",
    });
    expect(write).toHaveBeenCalledWith(
      JSON.stringify({
        event: "university.locale.requested",
        schemaVersion: 1,
        languageCode: "zh",
      }),
    );
  });
});
