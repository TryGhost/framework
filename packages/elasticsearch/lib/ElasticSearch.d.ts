/**
 * Ships documents to Elasticsearch using Node's built-in `fetch`.
 *
 * Request failures are swallowed (they are reported through `@tryghost/debug`
 * under `logging:elasticsearch`), so the returned promises always resolve.
 */
declare class ElasticSearch {
    /**
     * @param clientConfig Client config. `implementation: 'fetch'` is required.
     */
    constructor(clientConfig: ElasticSearch.ClientConfig);

    /** The selected implementation that calls are delegated to. */
    implementation: ElasticSearch.Implementation;

    /**
     * Write an event to Elasticsearch.
     * @param data Event data to index. Values that aren't objects are skipped.
     * @param index Either the index name, or a property bag containing the
     * index and other request parameters.
     */
    index(data: object, index: string | ElasticSearch.IndexParams): Promise<void>;

    /**
     * Write a batch of events to Elasticsearch with the bulk API, using the
     * `create` action. Requests are split to stay under Elasticsearch's 100 MB
     * default request limit; operations whose document isn't an object, can't
     * be serialised, or is too large on its own are skipped. Partial failures
     * are logged, not thrown.
     * @param operations Events to index, each with its target index.
     */
    bulk(operations: ReadonlyArray<ElasticSearch.BulkOperation>): Promise<void>;
}

declare namespace ElasticSearch {
    /**
     * The client that calls are delegated to.
     */
    interface Implementation {
        index(data: object, index: string | IndexParams): Promise<void>;
        bulk(operations: ReadonlyArray<BulkOperation>): Promise<void>;
    }

    /**
     * Index name plus extra request parameters, which are sent as query string
     * parameters. `null` and `undefined` values are left out.
     */
    interface IndexParams {
        index: string;
        [param: string]: string | number | boolean | null | undefined;
    }

    /**
     * A single document to write with {@link ElasticSearch.bulk}.
     */
    interface BulkOperation {
        /** Target index or data stream. */
        index: string;
        /** Document to write. */
        document: object;
    }

    /**
     * Basic auth credentials. Either may be left out.
     */
    interface BasicAuth {
        username?: string;
        password?: string;
    }

    /**
     * Client options.
     */
    interface ClientConfig {
        /** Use the `fetch`-based client. */
        implementation: 'fetch';
        /**
         * Elasticsearch URL. Credentials embedded in the URL are moved into a
         * Basic auth header.
         */
        node: string | URL;
        /** Basic auth credentials; these take precedence over any in `node`. */
        auth?: BasicAuth;
        /** Per-attempt request timeout in milliseconds. @default 30000 */
        requestTimeout?: number;
        /** Retries for network errors and retryable status codes. @default 3 */
        maxRetries?: number;
    }
}

export = ElasticSearch;
