// @tryghost/string does not publish declarations. Only its consumed API is modeled here.
declare module '@tryghost/string' {
    export function slugify(
        value: string | null | undefined,
        options?: { requiredChangesOnly?: boolean },
    ): string;
}
