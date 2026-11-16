import ExpectRequestClass = require('./ExpectRequest');
import Request = require('./Request');

/**
 * Makes requests against an Express app in-process, keeping cookies between
 * requests. Each HTTP method returns an `ExpectRequest` to chain assertions
 * on and await.
 */
declare class Agent {
    app: Agent.App;
    defaults: Agent.AgentOptions;
    /** Cookies set by responses and sent with later requests. */
    jar: Agent.CookieJar;
    /** Passed to each request; requests use jest-snapshot's manager when this is unset. */
    snapshotManager: Agent.SnapshotManager | undefined;

    /**
     * @param app The app to send requests to, such as an Express app.
     * @param defaults Defaults merged into every request.
     * @param snapshotManager Snapshot manager for the requests' snapshot assertions.
     */
    constructor(
        app: Agent.App,
        defaults?: Agent.AgentOptions,
        snapshotManager?: Agent.SnapshotManager,
    );

    get(url: string, options?: Agent.AgentOptions): ExpectRequestClass;
    post(url: string, options?: Agent.AgentOptions): ExpectRequestClass;
    put(url: string, options?: Agent.AgentOptions): ExpectRequestClass;
    patch(url: string, options?: Agent.AgentOptions): ExpectRequestClass;
    delete(url: string, options?: Agent.AgentOptions): ExpectRequestClass;
    options(url: string, options?: Agent.AgentOptions): ExpectRequestClass;
    head(url: string, options?: Agent.AgentOptions): ExpectRequestClass;

    /** Empty the cookie jar. */
    clearCookies(): this;
}

declare namespace Agent {
    /**
     * Request settings. Given to the constructor, they apply to every request;
     * given to a request, they are merged over the defaults.
     */
    interface AgentOptions {
        /** Path prefix for request URLs, e.g. `'/ghost/api/admin/'`. */
        baseUrl?: string;
        /** Query params appended to request URLs. */
        queryParams?: Record<string, string | number | boolean>;
        headers?: Record<string, Request.HeaderValue>;
        /** Body object, merged over the default body. */
        body?: object;
    }

    type App = Request.App;
    type Response = Request.Response;
    type CookieJar = Request.CookieJar;
    type Cookie = Request.Cookie;
    type CookieAccessInfo = Request.CookieAccessInfo;
    type HeaderValue = Request.HeaderValue;
    type SnapshotManager = ExpectRequestClass.SnapshotManager;
    type Assertion = ExpectRequestClass.Assertion;
    type SnapshotAssertion = ExpectRequestClass.SnapshotAssertion;
    type ExpectRequest = ExpectRequestClass;
}

export = Agent;
