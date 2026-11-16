import request = require('@tryghost/request');

/**
 * A log stream that POSTs each record as JSON to an HTTP endpoint.
 */
declare class HttpStream {
    config: HttpStream.HttpStreamConfig;

    constructor(config: HttpStream.HttpStreamConfig);

    /**
     * POST a log record. Resolves to the response, or `false` if shipping
     * failed (failures are never thrown).
     */
    write(data: object): Promise<unknown>;
}

declare namespace HttpStream {
    /**
     * Request options for shipping logs. `url` is required; the rest are
     * passed through to `@tryghost/request` (`method` and `json` are always
     * overridden with `POST` and the log record).
     */
    interface HttpStreamConfig extends request.RequestOptions {
        url: string;
    }
}

export = HttpStream;
