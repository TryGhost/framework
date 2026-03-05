import ghostString from '@tryghost/string';

const {slugify} = ghostString;

export function safe(string: string, options: { importing?: boolean } = {}): string {
    return slugify(string, {requiredChangesOnly: options.importing === true});
}
