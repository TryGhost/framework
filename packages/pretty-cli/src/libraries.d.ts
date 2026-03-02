declare module 'sywac/api' {
    interface ApiOptions {
        helpOpts?: Record<string, unknown>;
    }

    interface HelpVersionOptions {
        group?: string;
    }

    class Api {
        types: unknown[];
        static get(opts?: ApiOptions): Api;
        help(flags: string, opts?: HelpVersionOptions): Api;
        version(flags: string, opts?: HelpVersionOptions): Api;
        style(styles: Record<string, (str: string) => string>): Api;
        epilogue(str: string): Api;
        showHelpByDefault(): Api;
        parseAndExit(args?: string[]): Promise<unknown>;
        [key: string]: unknown;
    }

    export = Api;
}
