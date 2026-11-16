import SnapshotManagerClass = require('./SnapshotManager');

declare namespace jestSnapshot {
    type SnapshotManager = SnapshotManagerClass;
    type TestConfig = SnapshotManagerClass.TestConfig;
    type MatchResult = SnapshotManagerClass.MatchResult;
    type SnapshotAssertion = SnapshotManagerClass.SnapshotAssertion;
    type SnapshotAssertionError = SnapshotManagerClass.SnapshotAssertionError;

    /**
     * A Jest-style asymmetric matcher (from `@vitest/expect`), for use in
     * snapshot property matchers.
     */
    interface AsymmetricMatcher {
        $$typeof: symbol;
        asymmetricMatch(other: unknown): boolean;
        toString(): string;
        getExpectedType?(): string;
        toAsymmetricMatcher?(): string;
    }

    /** The mocha test available as `this.currentTest` in a `beforeEach` hook. */
    interface MochaCurrentTest {
        file?: string | undefined;
        currentRetry(): number;
        fullTitle(): string;
    }

    /** The `this` a should.js / chai assertion plugin is called with. */
    interface AssertionContext {
        obj: unknown;
        params: { operator: string; message?: string };
        assert(expression: boolean): void;
    }

    /** Mocha root hooks that drive `snapshotManager`. */
    interface MochaHooks {
        /** Reset the snapshot registry. */
        beforeAll(): void;
        /** Set the current test (resetting its registry on a retry) and load its snapshot file. */
        beforeEach(this: { currentTest: MochaCurrentTest }): Promise<void>;
        /** Write new and updated snapshots to disk. */
        afterAll(): Promise<void>;
    }

    /** The shared snapshot manager. */
    const snapshotManager: SnapshotManager;

    /** Mocha root hooks, e.g. `exports.mochaHooks = mochaHooks` in a `--require` file. */
    const mochaHooks: MochaHooks;

    /**
     * Assertion plugin that matches the asserted object against its stored
     * snapshot, e.g. `should.Assertion.add('matchSnapshot', matchSnapshotAssertion)`.
     */
    function matchSnapshotAssertion(this: AssertionContext, properties?: object | null): void;

    /**
     * Match any value created by `constructor` (or, for `String`, `Number`,
     * `Boolean`, `BigInt`, `Symbol`, `Function` and `Object`, any value of that
     * type), like Jest's `expect.any()`.
     */
    function any(
        constructor: (abstract new (...args: never[]) => unknown) | ((...args: never[]) => unknown),
    ): AsymmetricMatcher;

    /** Match anything except `null` and `undefined`, like Jest's `expect.anything()`. */
    function anything(): AsymmetricMatcher;

    /**
     * Match a string against `expected`, like Jest's `expect.stringMatching()`.
     * A string `expected` is used as a RegExp pattern.
     */
    function stringMatching(expected: string | RegExp): AsymmetricMatcher;
}

export = jestSnapshot;
