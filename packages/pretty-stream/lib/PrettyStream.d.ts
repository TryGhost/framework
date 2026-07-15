import { Transform, TransformOptions } from 'stream';

interface PrettyStreamOptions extends TransformOptions {
    /**
     * Controls how much detail is printed. Use `'long'` to include the
     * pretty-printed request/error body, anything else prints the short form.
     * @default 'short'
     */
    mode?: string;
}

/**
 * A Bunyan-compatible transform stream that turns raw JSON log records into
 * human-readable, colourised output.
 */
declare class PrettyStream extends Transform {
    mode: string;

    constructor(options?: PrettyStreamOptions);
}

export = PrettyStream;
