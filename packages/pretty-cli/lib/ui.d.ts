type Log = ((...args: unknown[]) => void) & {
    ok(...args: unknown[]): void;
    trace(...args: unknown[]): void;
    debug(...args: unknown[]): void;
    info(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    error(...args: unknown[]): void;
    fatal(...args: unknown[]): void;
};

declare const ui: { log: Log };
export = ui;
