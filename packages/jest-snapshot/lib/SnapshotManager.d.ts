/**
 * Stores and matches Jest-format snapshots for the current test, using
 * `@vitest/snapshot` under the hood.
 */
declare class SnapshotManager {
    /** Snapshot counters, keyed by test file path then test title. */
    registry: Record<string, Record<string, number>>;
    /** The test set by the last `setCurrentTest()` call. */
    currentTest: Partial<SnapshotManager.TestConfig>;
    /** Folder, next to the test file, that snapshot files are written to. */
    defaultSnapshotRoot: string;
    /**
     * `'all'` when one of the `SNAPSHOT_UPDATE`, `UPDATE_SNAPSHOT`,
     * `SNAPSHOTS_UPDATE` or `UPDATE_SNAPSHOTS` env vars was set at construction.
     */
    willUpdate: 'all' | 'new';

    constructor();

    /** Forget every snapshot counter. */
    resetRegistry(): void;

    /**
     * Forget the snapshot counters and recorded snapshot keys of the current
     * test, so a retry produces the same keys as the first attempt.
     */
    resetRegistryForCurrentTest(): void;

    /**
     * Set the current test and start loading its snapshot file. Await the
     * result (or `ready()`) before matching. Without a `testPath`, no file is
     * loaded and matching throws.
     */
    setCurrentTest(testConfig: Partial<SnapshotManager.TestConfig>): Promise<void>;

    /** Resolve once the current test's snapshot file has loaded. */
    ready(): Promise<void>;

    /** Write every loaded snapshot file to disk (when changed), then forget them. */
    saveSnapshots(): Promise<void>;

    /**
     * Match `response[assertion.field]` against the stored snapshot, throwing
     * `assertion.error` (with an updated message) if it is missing or does not
     * match. Requires the snapshot file to be loaded.
     */
    assertSnapshot(response: object, assertion: SnapshotManager.SnapshotAssertion): void;

    /**
     * Match `received` against the stored snapshot for the current test.
     * Property matchers in `properties` are checked first and replace the
     * matching values before comparison. Throws an `IncorrectUsageError` if no
     * current test is set or its snapshot file has not loaded.
     */
    match(
        received: unknown,
        properties?: object | null,
        hint?: string,
    ): SnapshotManager.MatchResult;
}

declare namespace SnapshotManager {
    interface TestConfig {
        /** Full path to the test file. */
        testPath: string;
        /** Full title of the test: every describe name and the test name. */
        testTitle: string;
    }

    interface MatchResult {
        pass: boolean;
        /** Failure message with a diff. Also set, but not meaningful, on a pass. */
        message: () => string;
        /**
         * On a failed match, the serialized received value or, when
         * `properties` did not match, the received value itself.
         */
        actual?: unknown;
        /**
         * On a failed match, the serialized snapshot or, when `properties`
         * did not match, the properties object.
         */
        expected?: unknown;
    }

    /**
     * The error thrown by `assertSnapshot()`. Its `message`, `expected`,
     * `actual` and `showDiff` are overwritten before it is thrown.
     */
    interface SnapshotAssertionError extends Error {
        /** Appended to the message, e.g. `'GET request on /posts/'`. */
        contextString?: string;
        expected?: unknown;
        actual?: unknown;
        showDiff?: boolean;
    }

    interface SnapshotAssertion {
        /** The `response` property to match, e.g. `'body'` or `'headers'`. */
        field: string;
        error: SnapshotAssertionError;
        /** Property matchers, as for `match()`. */
        properties?: object | null;
        /** Snapshot name hint. Defaults to `` `[${field}]` ``. */
        hint?: string;
    }
}

export = SnapshotManager;
