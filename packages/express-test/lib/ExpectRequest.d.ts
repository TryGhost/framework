import assert = require('assert');
import Request = require('./Request');

type ExpectRequestClass = typeof ExpectRequest;

/**
 * A `Request` with chainable assertions that run once the response arrives:
 * body and snapshot assertions first, then headers, then the status code.
 * Awaiting it rejects with the first failed assertion.
 */
declare class ExpectRequest extends Request {
    assertions: ExpectRequest.Assertion[];
    snapshotManager: ExpectRequest.SnapshotManager;

    /**
     * @param snapshotManager Defaults to `snapshotManager` from `@tryghost/jest-snapshot`.
     */
    constructor(
        app: Request.App,
        cookieJar: Request.CookieJar,
        reqOptions?: Request.RequestOptions | Request.RequestOptionsInit,
        snapshotManager?: ExpectRequest.SnapshotManager | null,
    );

    /** Run a custom assertion against the response; throw to fail it. */
    expect(callback: (response: Request.Response) => void): this;

    /** Assert the status code (compared with `==`). */
    expectStatus(expected: number): this;

    /**
     * Assert that a header exists and equals `expectedValue`, or matches it
     * when it is a RegExp. The header name is case-insensitive.
     */
    expectHeader(expectedField: string, expectedValue: string | number | RegExp): this;

    /** Assert the parsed body is `{}`, e.g. for a non-JSON or empty response. */
    expectEmptyBody(): this;

    /** Match the parsed body against its snapshot, with optional property matchers. */
    matchBodySnapshot(properties?: object): this;

    /** Match the response headers against their snapshot, with optional property matchers. */
    matchHeaderSnapshot(properties?: object): this;
}

declare namespace ExpectRequest {
    /**
     * What `ExpectRequest` needs from a snapshot manager, such as
     * `snapshotManager` from `@tryghost/jest-snapshot`.
     */
    interface SnapshotManager {
        assertSnapshot(response: Request.Response, assertion: SnapshotAssertion): void;
        /** Awaited, when present, before the assertions run. */
        ready?(): unknown;
    }

    /** A queued assertion. */
    interface Assertion {
        fn: (response: Request.Response, assertion: Assertion) => void;
        /** Body assertions run first, then header and then status assertions. */
        type: 'body' | 'header' | 'status';
        /** Thrown if the assertion fails. Created when it is queued, for a useful stack. */
        error: assert.AssertionError & {
            /** E.g. `'GET request on /posts/'`. */
            contextString: string;
            showDiff?: boolean;
        };
        expected?: unknown;
        expectedField?: string;
        expectedValue?: string | number | RegExp;
        field?: string;
        properties?: object;
    }

    /** A queued `matchBodySnapshot()` or `matchHeaderSnapshot()` assertion. */
    interface SnapshotAssertion extends Assertion {
        field: 'body' | 'headers';
        properties: object;
    }

    type RequestOptions = Request.RequestOptions;
    const RequestOptions: typeof Request.RequestOptions;
    const ExpectRequest: ExpectRequestClass;
}

export = ExpectRequest;
