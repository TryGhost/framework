// @tryghost/string does not publish declarations. Only its consumed API is modeled here.
// TODO: Remove this shim when @tryghost/string publishes its own declarations.
declare module '@tryghost/string' {
    export function slugify(
        value: string | null | undefined,
        options?: { requiredChangesOnly?: boolean },
    ): string;
}
