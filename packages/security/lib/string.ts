import { slugify } from '@tryghost/string';

/** Normalizes slugs, treating null or omitted values as an empty string. */
export function safe(string?: string | null, options: { importing?: boolean } = {}): string {
    return slugify(string, { requiredChangesOnly: options.importing === true });
}
