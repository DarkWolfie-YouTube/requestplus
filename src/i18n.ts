import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import pt from './locales/pt.json';

type LocaleStrings = Record<string, string>;

const locales: Record<string, LocaleStrings> = { en, es, fr, pt };

export type SupportedLocale = 'en' | 'es' | 'fr' | 'pt';

/**
 * Translate a locale key, falling back to English if the key is missing
 * in the requested locale, then falling back to the key itself.
 */
export function t(key: string, locale: string = 'en', vars?: Record<string, string>): string {
    const strings = locales[locale] ?? locales.en;
    let value: string = strings[key] ?? locales.en[key] ?? key;

    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
        }
    }

    return value;
}
