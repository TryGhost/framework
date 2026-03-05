import chalk from 'chalk';

type LogFunction = {
    (...args: unknown[]): void;
    ok: (...args: unknown[]) => void;
    trace: (...args: unknown[]) => void;
    debug: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    fatal: (...args: unknown[]) => void;
};

const log: LogFunction = ((...args: unknown[]): void => {
    console.log(...args); // eslint-disable-line no-console
}) as LogFunction;

log.ok = (...args: unknown[]): void => {
    log(chalk.green('ok'), ...args);
};

log.trace = (...args: unknown[]): void => {
    log(chalk.gray('trace'), ...args);
};

log.debug = (...args: unknown[]): void => {
    log(chalk.gray('debug'), ...args);
};

log.info = (...args: unknown[]): void => {
    log(chalk.cyan('info'), ...args);
};

log.warn = (...args: unknown[]): void => {
    log(chalk.magenta('warn'), ...args);
};

log.error = (...args: unknown[]): void => {
    log(chalk.red('error'), ...args);
};

log.fatal = (...args: unknown[]): void => {
    log(chalk.inverse('fatal'), ...args);
};

export {log};
