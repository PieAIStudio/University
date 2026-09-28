import { createI18n } from "@pieai/swimmer-i18n-kit";
import type { NerveLanguage } from "@pieai/swimmer-nerve-kit/i18n";
import { nerveCatalogs } from "@pieai/swimmer-nerve-kit/i18n/catalogs";

/*
  涟's words in University's language (SwimmerNerveKit 0.7, language.md).

  Nerve ships its own catalogs and no engine; University supplies the engine it
  already runs, once, here beside the product's language entry. The catalogs
  are Nerve's, never copied into the product's; the locale is the product's one
  preference, never a second store. Built at module load, not per render.
*/
const surface = createI18n<Readonly<Record<string, string>>>(nerveCatalogs.surface);
const core = createI18n<Readonly<Record<string, string>>>(nerveCatalogs.core);
const voice = createI18n<Readonly<Record<string, string>>>(nerveCatalogs.voice);

export function nerveLanguage(locale: string): NerveLanguage {
  return {
    surface: surface.translator(locale),
    core: core.translator(locale),
    voice: voice.translator(locale),
  };
}
