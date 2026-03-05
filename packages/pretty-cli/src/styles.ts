import chalk from 'chalk';

export interface Styles {
    usagePrefix: (str: string) => string;
    group: (str: string) => string;
    flags: (str: string) => string;
    hints: (str: string) => string;
    groupError: (str: string) => string;
    flagsError: (str: string) => string;
    descError: (str: string) => string;
    hintsError: (str: string) => string;
    messages: (str: string) => string;
}

const styles: Styles = {
    // Usage: script [options] etc
    usagePrefix: (str: string): string => {
        return chalk.yellow(str.slice(0, 6)) + '\n  ' + str.slice(7);
    },
    // Options: Arguments: etc
    group: (str: string): string => chalk.yellow(str),
    // --help etc
    flags: (str: string): string => chalk.green(str),
    // [required] [boolean] etc
    hints: (str: string): string => chalk.dim(str),
    // Use different style when a type is invalid
    groupError: (str: string): string => chalk.red(str),
    flagsError: (str: string): string => chalk.red(str),
    descError: (str: string): string => chalk.yellow(str),
    hintsError: (str: string): string => chalk.red(str),
    // style error messages
    messages: (str: string): string => chalk.red(str)
};

export default styles;
