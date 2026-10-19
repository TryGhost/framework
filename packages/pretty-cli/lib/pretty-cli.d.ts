import ui = require('./ui');
import styles = require('./styles');

declare namespace prettyCli {
    /** Parsed arguments are dynamic; narrow values before using them. */
    type Args = Record<string, unknown>;
    type Flags = string | string[];
    type Version = string | (() => string);
    type Style = (text: string, details?: unknown) => string;
    type Styles = Partial<
        Record<
            | 'group'
            | 'groupError'
            | 'flags'
            | 'flagsError'
            | 'desc'
            | 'descError'
            | 'hints'
            | 'hintsError'
            | 'messages'
            | 'usagePrefix'
            | 'usagePositionals'
            | 'usageCommandPlaceholder'
            | 'usageArgsPlaceholder'
            | 'usageOptionsPlaceholder'
            | 'example'
            | 'all',
            Style
        >
    >;
    type OutputSettings = {
        lineSep?: string;
        sectionSep?: string;
        pad?: string;
        indent?: string;
        split?: string | RegExp;
        maxWidth?: number;
        examplePrefix?: string;
        showHelpOnError?: boolean;
    };
    type ApiOptions = {
        helpOpts?: OutputSettings;
        name?: string;
        parentName?: string;
        strictMode?: boolean;
        showHelpByDefault?: boolean;
    };
    type OptionOptions = {
        flags?: string;
        aliases?: Flags;
        type?: string;
        desc?: string;
        description?: string;
        defaultValue?: unknown;
        required?: boolean;
        strict?: boolean;
        hidden?: boolean;
        hints?: string;
        group?: string;
        choices?: unknown[];
        version?: Version;
        mustExist?: boolean;
        dirAllowed?: boolean;
        fileAllowed?: boolean;
        normalize?: boolean;
        asObject?: boolean;
        asPosix?: boolean;
        asWin32?: boolean;
        coerce?: (value: unknown) => unknown;
    };
    type PositionalParameters = Array<string | OptionOptions> | Record<string, OptionOptions>;
    type PositionalOptions = OptionOptions & {
        params?: PositionalParameters;
        paramsDescription?: string | string[];
        paramsDesc?: string | string[];
        paramsGroup?: string;
        ignore?: string[];
    };
    type CommandHandler = (argv: Args, context: Context) => unknown;
    type CommandOptions = PositionalOptions & {
        setup?: (api: Api) => void;
        run?: CommandHandler;
    };
    type CommandDirectoryOptions = CommandOptions & { extensions?: string[] };
    type CommandDefinition = CommandOptions & ({ flags: string } | { aliases: Flags });
    type ExampleOptions = { flags?: string; desc?: string; description?: string; group?: string };
    type UsageOptions = {
        usage?: string;
        prefix?: string;
        commandPlaceholder?: string;
        argsPlaceholder?: string;
        optionsPlaceholder?: string;
    };
    type Details = { args: string[]; types: unknown[] };
    type ParseResult = {
        code: number;
        output: string;
        errors: unknown[];
        argv: Args;
        details: Details;
    };
    type Context = ParseResult & {
        commandHandlerRun: boolean;
        helpRequested: boolean | OutputSettings;
        versionRequested: boolean | { version?: Version };
        cliMessage(message: unknown, ...args: unknown[]): void;
        deferHelp(options?: OutputSettings): Context;
    };
    type Api = CliApi;
}

declare class CliApi {
    constructor(options?: prettyCli.ApiOptions);
    static get(options?: prettyCli.ApiOptions): CliApi;
    static readonly DEFAULT_COMMAND_INDICATOR: string;
    readonly name: string;
    readonly parentName: string;
    readonly types: unknown[];

    configure(options?: prettyCli.ApiOptions): this;
    newChild(name: string, options?: prettyCli.ApiOptions): CliApi;
    strict(enabled?: boolean): this;
    showHelpByDefault(enabled?: boolean): this;
    preface(icon: string, slogan?: string): this;
    usage(usage: string | prettyCli.UsageOptions): this;
    groupOrder(groups?: string[]): this;
    example(example: string | prettyCli.ExampleOptions, options?: prettyCli.ExampleOptions): this;
    exampleOrder(groups?: string[]): this;
    epilogue(text: string): this;
    outputSettings(settings: prettyCli.OutputSettings): this;
    style(hooks: prettyCli.Styles): this;

    command(options: prettyCli.CommandDefinition): this;
    command(flags: string, options?: prettyCli.CommandOptions | prettyCli.CommandHandler): this;
    commandDirectory(directory: string, options?: prettyCli.CommandDirectoryOptions): this;
    commandDirectory(options?: prettyCli.CommandDirectoryOptions): this;
    positional(
        flags: string | prettyCli.PositionalParameters | prettyCli.PositionalOptions,
        options?: prettyCli.PositionalOptions,
    ): this;
    option(
        flags: prettyCli.Flags | prettyCli.OptionOptions,
        options?: prettyCli.OptionOptions,
    ): this;
    boolean(
        flags: prettyCli.Flags | prettyCli.OptionOptions,
        options?: prettyCli.OptionOptions,
    ): this;
    string(
        flags: prettyCli.Flags | prettyCli.OptionOptions,
        options?: prettyCli.OptionOptions,
    ): this;
    number(
        flags: prettyCli.Flags | prettyCli.OptionOptions,
        options?: prettyCli.OptionOptions,
    ): this;
    path(flags: prettyCli.Flags | prettyCli.OptionOptions, options?: prettyCli.OptionOptions): this;
    file(flags: prettyCli.Flags | prettyCli.OptionOptions, options?: prettyCli.OptionOptions): this;
    dir(flags: prettyCli.Flags | prettyCli.OptionOptions, options?: prettyCli.OptionOptions): this;
    enumeration(
        flags: prettyCli.Flags | prettyCli.OptionOptions,
        options?: prettyCli.OptionOptions,
    ): this;
    help(
        flags?: prettyCli.Flags | prettyCli.OptionOptions,
        options?: prettyCli.OptionOptions,
    ): this;
    version(
        flags?: prettyCli.Flags | prettyCli.OptionOptions,
        options?: prettyCli.OptionOptions,
    ): this;
    array(
        flags: prettyCli.Flags | prettyCli.OptionOptions,
        options?: prettyCli.OptionOptions,
    ): this;
    stringArray(
        flags: prettyCli.Flags | prettyCli.OptionOptions,
        options?: prettyCli.OptionOptions,
    ): this;
    numberArray(
        flags: prettyCli.Flags | prettyCli.OptionOptions,
        options?: prettyCli.OptionOptions,
    ): this;
    check(handler: prettyCli.CommandHandler): this;
    parse(args?: string | string[]): Promise<prettyCli.ParseResult>;
    parseAndExit(args?: string | string[]): Promise<prettyCli.Args>;
    getHelp(options?: prettyCli.OutputSettings): string;
}

/** The styled process-wide instance; Api.get() creates an unstyled fresh instance. */
declare const prettyCli: CliApi & {
    Api: typeof CliApi;
    styles: typeof styles;
    ui: typeof ui;
};

export = prettyCli;
