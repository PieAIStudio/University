/**
 * Anonymous demand signal for languages the browser asks for.
 *
 * The entry deliberately contains no user, session, URL, device, timestamp or
 * raw locale. It records only the language subtag from navigator.language so
 * support order can follow observed demand without introducing analytics.
 */
export interface LocaleDemandEntry {
  readonly event: "university.locale.requested";
  readonly schemaVersion: 1;
  readonly languageCode: string;
}

export interface LocaleDemandPort {
  record(entry: LocaleDemandEntry): Promise<void> | void;
}

export function languageCodeOf(requestedLocale: string | undefined | null): string | null {
  if (!requestedLocale) return null;
  const match = /^([A-Za-z]{2,8})(?:[-_].*)?$/.exec(requestedLocale.trim());
  return match?.[1]?.toLowerCase() ?? null;
}

export function recordLocaleRequest(
  port: LocaleDemandPort,
  requestedLocale: string | undefined | null,
): LocaleDemandEntry | null {
  const languageCode = languageCodeOf(requestedLocale);
  if (!languageCode) return null;
  const entry: LocaleDemandEntry = {
    event: "university.locale.requested",
    schemaVersion: 1,
    languageCode,
  };
  void port.record(entry);
  return entry;
}

export function createConsoleLocaleDemandPort(
  write: (line: string) => void = (line) => console.info(line),
): LocaleDemandPort {
  return {
    record(entry) {
      write(JSON.stringify(entry));
    },
  };
}

export const localeDemandPort = createConsoleLocaleDemandPort();
