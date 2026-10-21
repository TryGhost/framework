import { slugify } from '@tryghost/string';

/**
 * @param {string} string
 * @param {{importing?: boolean}} [options]
 */
export function safe(string?: string | null, options: { importing?: boolean } = {}): string {
    return slugify(string, { requiredChangesOnly: options.importing === true });
}
