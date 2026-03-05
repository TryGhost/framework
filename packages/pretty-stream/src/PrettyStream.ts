import { asString } from 'date-format';
import { Transform } from 'node:stream';
import type { TransformCallback, TransformOptions } from 'node:stream';
import { format } from 'node:util';
import { render } from 'prettyjson';

type ColorName = 'default' | 'bold' | 'italic' | 'underline' | 'inverse' |
    'white' | 'grey' | 'black' | 'blue' | 'cyan' | 'green' | 'magenta' | 'red' | 'yellow';

type LogLevel = 10 | 20 | 30 | 40 | 50 | 60;

interface ErrorObject {
    message: string;
    stack: string;
    errorType?: string;
    id?: string;
    code?: string;
    context?: string;
    help?: string;
    errorDetails?: string;
    hideStack?: boolean;
}

interface RequestObject {
    method: string;
    originalUrl: string;
    [key: string]: unknown;
}

interface ResponseObject {
    statusCode: number;
    responseTime: string;
    [key: string]: unknown;
}

interface LogRecord {
    time?: string;
    level: LogLevel;
    name?: string;
    hostname?: string;
    pid?: number;
    v?: number;
    msg?: string;
    req?: RequestObject;
    res?: ResponseObject;
    err?: ErrorObject;
    [key: string]: unknown;
}

interface PrettyStreamOptions extends TransformOptions {
    mode?: string;
}

const OMITTED_KEYS = ['time', 'level', 'name', 'hostname', 'pid', 'v', 'msg'];

const _private = {
    levelFromName: {
        10: 'trace',
        20: 'debug',
        30: 'info',
        40: 'warn',
        50: 'error',
        60: 'fatal'
    } as Record<number, string>,
    colorForLevel: {
        10: 'grey',
        20: 'grey',
        30: 'cyan',
        40: 'magenta',
        50: 'red',
        60: 'inverse'
    } as Record<number, ColorName>,
    colors: {
        default: [39, 39],
        bold: [1, 22],
        italic: [3, 23],
        underline: [4, 24],
        inverse: [7, 27],
        white: [37, 39],
        grey: [90, 39],
        black: [30, 39],
        blue: [34, 39],
        cyan: [36, 39],
        green: [32, 39],
        magenta: [35, 39],
        red: [31, 39],
        yellow: [33, 39]
    } as Record<ColorName, [number, number]>
};

function colorize(colors: ColorName | ColorName[], value: string): string {
    if (Array.isArray(colors)) {
        return colors.reduce((acc: string, color: ColorName) => colorize(color, acc), value);
    } else {
        return '\x1B[' + _private.colors[colors][0] + 'm' + value + '\x1B[' + _private.colors[colors][1] + 'm';
    }
}

function statusCode(status: number): string {
    /* eslint-disable indent */
    const color: ColorName = status >= 500 ? 'red'
        : status >= 400 ? 'yellow'
        : status >= 300 ? 'cyan'
        : status >= 200 ? 'green'
        : 'default'; // no color
    /* eslint-enable indent */

    return colorize(color, String(status));
}

class PrettyStream extends Transform {
    mode: string;

    constructor(options?: PrettyStreamOptions) {
        options = options || {};
        super(options);

        this.mode = options.mode || 'short';
    }

    write(data: unknown, enc?: BufferEncoding | ((error: Error | null | undefined) => void), cb?: (error: Error | null | undefined) => void): boolean {
        // Bunyan sometimes passes things as objects. Because of this, we need to make sure
        // the data is converted to JSON
        if (typeof data === 'object' && data !== null && !(data instanceof Buffer)) {
            data = JSON.stringify(data);
        }

        return super.write(data as string, enc as BufferEncoding, cb as ((error: Error | null | undefined) => void));
    }

    _transform(data: Buffer | string, enc: BufferEncoding | null, cb: TransformCallback): void {
        let dataStr: string;
        if (typeof data !== 'string') {
            dataStr = data.toString();
        } else {
            dataStr = data;
        }

        // Remove trailing newline if any
        dataStr = dataStr.replace(/\\n$/, '');

        let record: LogRecord;
        try {
            record = JSON.parse(dataStr) as LogRecord;
        } catch (err) {
            cb(err as Error);
            // If data is not JSON we don't want to continue processing as if it is
            return;
        }

        let output = '';

        // Handle time formatting
        let time: string;

        if (record.time) {
            // If time is provided as a string in the expected format, use it directly
            if (typeof record.time === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(record.time)) {
                time = record.time;
            } else {
                // Otherwise, parse and format it
                const dataTime = new Date(record.time);
                time = asString('yyyy-MM-dd hh:mm:ss', dataTime);
            }
        } else {
            // No time provided, use current time
            const now = new Date();
            time = asString('yyyy-MM-dd hh:mm:ss', now);
        }

        let logLevel = _private.levelFromName[record.level].toUpperCase();
        const codes = _private.colors[_private.colorForLevel[record.level]];
        let bodyPretty = '';

        logLevel = '\x1B[' + codes[0] + 'm' + logLevel + '\x1B[' + codes[1] + 'm';

        if (record.req) {
            output += format('[%s] %s "%s %s" %s %s\n',
                time,
                logLevel,
                record.req.method.toUpperCase(),
                record.req.originalUrl,
                statusCode(record.res!.statusCode),
                record.res!.responseTime
            );
        } else if (record.msg === undefined) {
            output += format('[%s] %s\n',
                time,
                logLevel
            );
        } else {
            bodyPretty += record.msg;
            output += format('[%s] %s %s\n', time, logLevel, bodyPretty);
        }

        const filteredEntries = Object.entries(record).filter(([key]) => !OMITTED_KEYS.includes(key));
        for (const [key, value] of filteredEntries) {
            // we always output errors for now
            if (typeof value === 'object' && value !== null && 'message' in value && 'stack' in value) {
                const errValue = value as ErrorObject;
                let error = '\n';

                if (errValue.errorType) {
                    error += colorize(_private.colorForLevel[record.level], 'Type: ' + errValue.errorType) + '\n';
                }

                error += colorize(_private.colorForLevel[record.level], errValue.message) + '\n\n';

                if (errValue.context) {
                    error += colorize('white', errValue.context) + '\n';
                }

                if (errValue.help) {
                    error += colorize('yellow', errValue.help) + '\n';
                }

                if (errValue.context || errValue.help) {
                    error += '\n';
                }

                if (errValue.id) {
                    error += colorize(['white', 'bold'], 'Error ID:') + '\n';
                    error += '    ' + colorize('grey', errValue.id) + '\n\n';
                }

                if (errValue.code) {
                    error += colorize(['white', 'bold'], 'Error Code: ') + '\n';
                    error += '    ' + colorize('grey', errValue.code) + '\n\n';
                }

                if (errValue.errorDetails) {
                    let details: unknown = errValue.errorDetails;

                    try {
                        const jsonDetails = JSON.parse(errValue.errorDetails);
                        details = Array.isArray(jsonDetails) ? jsonDetails[0] : jsonDetails;
                    } catch (err) {
                        // no need for special handling as we default to unparsed 'errorDetails'
                    }

                    const pretty = render(details, {
                        noColor: true
                    }, 4);

                    error += colorize(['white', 'bold'], 'Details:') + '\n';
                    error += colorize('grey', pretty) + '\n\n';
                }

                if (errValue.stack && !errValue.hideStack) {
                    error += colorize('grey', '----------------------------------------') + '\n\n';
                    error += colorize('grey', errValue.stack) + '\n';
                }

                output += format('%s\n', colorize(_private.colorForLevel[record.level], error));
            } else if (typeof value === 'object' && value !== null) {
                bodyPretty += '\n' + colorize('yellow', key.toUpperCase()) + '\n';

                const sanitized: Record<string, unknown> = {};

                for (const [innerKey, innerValue] of Object.entries(value as Record<string, unknown>)) {
                    if (innerValue !== null && innerValue !== undefined && innerValue !== '' &&
                        !(typeof innerValue === 'object' && Object.keys(innerValue as Record<string, unknown>).length === 0)) {
                        sanitized[innerKey] = innerValue;
                    }
                }

                bodyPretty += render(sanitized, {}) + '\n';
            } else {
                bodyPretty += render(value, {}) + '\n';
            }
        }

        if (this.mode !== 'short' && (bodyPretty !== record.msg)) {
            output += format('%s\n', colorize('grey', bodyPretty));
        }

        cb(null, output);
    }
}

export default PrettyStream;
