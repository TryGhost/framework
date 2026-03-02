declare module '@tryghost/string' {
    interface SlugifyOptions {
        requiredChangesOnly?: boolean;
    }
    const value: {
        slugify(input: string, options?: SlugifyOptions): string;
    };
    export default value;
}

declare module 'bcryptjs' {
    export function genSalt(rounds: number): Promise<string>;
    export function hash(s: string, salt: string): Promise<string>;
    export function compare(s: string, hash: string): Promise<boolean>;
}
