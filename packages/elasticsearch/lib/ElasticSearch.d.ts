/**
 * Ships documents to Elasticsearch through one of two implementations:
 * `legacy` (the default) wraps the official `@elastic/elasticsearch` client,
 * `fetch` uses Node's built-in `fetch`.
 *
 * Both implementations swallow request failures (they are reported through
 * `@tryghost/debug` under `logging:elasticsearch`), so the returned promises
 * always resolve.
 */
declare class ElasticSearch {
    /**
     * @param clientConfig Client config, plus `implementation` to choose
     * between `legacy` (default) and `fetch`. At runtime any value other than
     * `'fetch'` selects `legacy`.
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
     * The surface shared by the `legacy` and `fetch` implementations.
     */
    interface Implementation {
        index(data: object, index: string | IndexParams): Promise<void>;
        bulk(operations: ReadonlyArray<BulkOperation>): Promise<void>;
    }

    /**
     * Index name plus extra request parameters. With `legacy` the parameters
     * are passed to the client's `index()` call; with `fetch` they are sent as
     * query string parameters, leaving out `null` and `undefined` values.
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
     * API key auth, supported by the `legacy` implementation.
     */
    interface ApiKeyAuth {
        apiKey: string | { id: string; api_key: string };
    }

    /**
     * Bearer token auth, supported by the `legacy` implementation.
     */
    interface BearerAuth {
        bearer: string;
    }

    /**
     * A node definition accepted by the `@elastic/elasticsearch` client.
     */
    interface LegacyNodeOptions {
        url: URL;
        [option: string]: unknown;
    }

    type LegacyNode = string | string[] | LegacyNodeOptions | LegacyNodeOptions[];

    /**
     * Options for the `legacy` implementation, which are passed to the
     * `@elastic/elasticsearch` `Client` constructor. Only the commonly used
     * options are listed; any other client option is passed through.
     *
     * The underlying client is a process-wide singleton created from the first
     * config, so later instances reuse its connection pool and ignore their own
     * config.
     */
    interface LegacyClientOptions {
        implementation?: 'legacy';
        auth?: BasicAuth | ApiKeyAuth | BearerAuth;
        /** Request timeout in milliseconds. */
        requestTimeout?: number;
        /** Retries for failed requests. */
        maxRetries?: number;
        /** Proxy URL; `null` or absent means no proxy. */
        proxy?: string | URL | null;
        [option: string]: unknown;
    }

    /**
     * `legacy` config. The client requires one of `node`, `nodes` or `cloud`.
     */
    type LegacyClientConfig = LegacyClientOptions &
        ({ node: LegacyNode } | { nodes: LegacyNode } | { cloud: { id: string } });

    /**
     * Options for the `fetch` implementation.
     */
    interface FetchClientConfig {
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

    type ClientConfig = LegacyClientConfig | FetchClientConfig;
}

export = ElasticSearch;
