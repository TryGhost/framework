declare module 'bunyan-loggly' {
    import {Writable} from 'stream';
    interface BunyanLogglyOptions {
        token: string;
        subdomain: string;
        tags?: string[];
    }
    class Bunyan2Loggly extends Writable {
        constructor(options: BunyanLogglyOptions);
        write(chunk: unknown, encoding?: BufferEncoding, callback?: (error?: Error | null) => void): boolean;
    }
    export = Bunyan2Loggly;
}

declare module 'gelf-stream' {
    import {Writable} from 'stream';
    interface GelfOptions {
        [key: string]: unknown;
    }
    class GelfStream extends Writable {
        _write(chunk: unknown, encoding: BufferEncoding, callback: (error?: Error | null) => void): void;
    }
    function forBunyan(host: string, port: number, options?: GelfOptions): GelfStream;
    export {forBunyan, GelfStream};
}

declare module '@tryghost/pretty-stream' {
    import {Transform} from 'stream';
    interface PrettyStreamOptions {
        mode?: string;
    }
    class GhostPrettyStream extends Transform {
        constructor(options?: PrettyStreamOptions);
        write(chunk: unknown, encoding?: BufferEncoding, callback?: (error?: Error | null) => void): boolean;
    }
    export = GhostPrettyStream;
}

declare module '@tryghost/http-stream' {
    import {Writable} from 'stream';
    interface HttpStreamOptions {
        url?: string;
        headers?: Record<string, string>;
        username?: string;
        password?: string;
    }
    class HttpStream extends Writable {
        constructor(options: HttpStreamOptions);
        write(chunk: unknown, encoding?: BufferEncoding, callback?: (error?: Error | null) => void): boolean;
    }
    export = HttpStream;
}

declare module '@tryghost/elasticsearch' {
    interface ElasticSearchAuth {
        username?: string;
        password?: string;
    }
    interface ElasticSearchOptions {
        node?: string;
        auth?: ElasticSearchAuth;
    }
    interface ElasticSearchStream {
        write(data: object): void;
    }
    export class BunyanStream {
        constructor(options: ElasticSearchOptions, index?: string, pipeline?: string);
        getStream(): ElasticSearchStream;
    }
}

declare module '@tryghost/bunyan-rotating-filestream' {
    import {Writable} from 'stream';
    interface RotatingFileStreamOptions {
        path: string;
        period?: string;
        threshold?: string;
        totalFiles?: number;
        gzip?: boolean;
        rotateExisting?: boolean;
    }
    class RotatingFileStream extends Writable {
        constructor(options: RotatingFileStreamOptions);
    }
    export = RotatingFileStream;
}

declare module '@tryghost/root-utils' {
    export function getProcessRoot(): string;
}
