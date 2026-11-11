const { SnapshotClient } = require('@vitest/snapshot');
const { NodeSnapshotEnvironment } = require('@vitest/snapshot/environment');
const { equals, iterableEquality, subsetEquality } = require('@vitest/expect');
const { diff } = require('@vitest/utils/diff');
const errors = require('@tryghost/errors');
const assert = require('assert');
const path = require('path');
const { makeMessageFromMatchMessage } = require('./utils');

const DOT_EXTENSION = '.snap';

// Keep the header jest-snapshot wrote so existing snapshot files are not
// rewritten just because the engine changed.
const SNAPSHOT_HEADER = '// Jest Snapshot v1, https://jestjs.io/docs/snapshot-testing';

// jest-snapshot used pretty-format's defaults (no snapshotFormat passed),
// which print `Object {` / `Array [` and escape quotes inside strings.
// @vitest/snapshot defaults both of these to false.
const SNAPSHOT_FORMAT = {
    printBasicPrototype: true,
    escapeString: true,
};

/**
 * Determines whether to update all snapshots or only new ones
 * @returns {'all' | 'new'}
 */
function willUpdate() {
    const updateSnapshots =
        process.env.SNAPSHOT_UPDATE ||
        process.env.UPDATE_SNAPSHOT ||
        process.env.SNAPSHOTS_UPDATE ||
        process.env.UPDATE_SNAPSHOTS;

    return updateSnapshots ? 'all' : 'new';
}

/**
 * Merges property matchers into the received value, as jest-snapshot does
 * before serializing: matchers (and primitives) replace the received value,
 * plain objects and arrays merge key-by-key / index-by-index, and anything in
 * `received` that `properties` doesn't mention is kept.
 *
 * @param {unknown} received
 * @param {unknown} properties
 * @returns {unknown}
 */
function mergeProperties(received, properties) {
    if (Array.isArray(received) && Array.isArray(properties)) {
        const merged = [...received];
        properties.forEach((value, index) => {
            merged[index] = mergeProperties(received[index], value);
        });
        return merged;
    }

    const isMergeable = (value) =>
        value !== null && typeof value === 'object' && !Array.isArray(value) && !value.$$typeof;

    if (isMergeable(received) && isMergeable(properties)) {
        const merged = { ...received };
        for (const key of Object.keys(properties)) {
            merged[key] =
                key in received ? mergeProperties(received[key], properties[key]) : properties[key];
        }
        return merged;
    }

    return properties;
}

class JestCompatSnapshotEnvironment extends NodeSnapshotEnvironment {
    /**
     * @param {SnapshotManager} manager
     */
    constructor(manager) {
        super();
        this.manager = manager;
    }

    getHeader() {
        return SNAPSHOT_HEADER;
    }

    async resolvePath(filepath) {
        return this.manager._resolveSnapshotFilePath(filepath);
    }
}

class SnapshotManager {
    constructor() {
        this.registry = {};
        this.currentTest = {};
        this.defaultSnapshotRoot = '__snapshots__';

        // Set willUpdate once, as it  can't change whilst we are running
        this.willUpdate = willUpdate();

        this.snapshotEnvironment = new JestCompatSnapshotEnvironment(this);
        this.client = new SnapshotClient();

        /** @type {Promise<void>} */
        this._pendingSetup = Promise.resolve();
    }

    /**
     * Looks in the registry for a snapshot with the same filename and nameTemplate
     * If needed, increments the counter
     * Returns nametemplate with the counter appended.
     *
     * @param {string} testPath e.g. '/path/to/tests/my-fake.test.js'
     * @param {string} testTitle e.g. 'My fake test title'
     * @returns {string} e.g. 'My fake test title 1'
     */
    _getNameForSnapshot(testPath, testTitle) {
        if (!(testPath in this.registry)) {
            this.registry[testPath] = {};
        }

        const nextCounter = (this.registry[testPath][testTitle] || 0) + 1;
        this.registry[testPath][testTitle] = nextCounter;

        return `${testTitle} ${nextCounter}`;
    }

    /**
     * Takes the full path to the test file and returns the full path to the snapshot file
     *
     * @param {string} testPath e.g. '/path/to/tests/my-fake.test.js'
     * @returns {string} snapshotFilePath e.g. '/path/to/tests/__snapshots__/my-fake.test.js.snap'
     */
    _resolveSnapshotFilePath(testPath) {
        return path.join(
            path.join(path.dirname(testPath), this.defaultSnapshotRoot),
            path.basename(testPath) + DOT_EXTENSION,
        );
    }

    /**
     * Returns config for the current test
     * Throws an error if the current test is not configured
     * @returns {{testPath: string, testTitle: string, snapshotName: string, snapshotPath: string}}
     */
    _getConfig() {
        if (!this.currentTest.testPath || !this.currentTest.testTitle) {
            throw new errors.IncorrectUsageError({
                message: 'Unable to run snapshot tests, current test was not configured',
                context:
                    'Snapshot testing requires current test filename and nameTemplate to be set for each test',
                help: 'Did you forget to do export.mochaHooks?',
            });
        }

        const { testPath, testTitle } = this.currentTest;

        const snapshotName = this._getNameForSnapshot(testPath, testTitle);
        const snapshotPath = this._resolveSnapshotFilePath(testPath);

        return { testPath, testTitle, snapshotName, snapshotPath };
    }

    /**
     * Resets the registry to an empty object
     */
    resetRegistry() {
        this.registry = {};
    }

    /**
     * Resets the registry for the current test only
     * Also clears any snapshot keys the engine recorded for this test so a
     * retry produces the same keys as the first attempt.
     */
    resetRegistryForCurrentTest() {
        const { testPath, testTitle } = this.currentTest;
        if (testPath in this.registry && testTitle in this.registry[testPath]) {
            delete this.registry[testPath][testTitle];
        }
        if (testPath && this.client.snapshotStateMap.has(testPath)) {
            this.client.clearTest(testPath, testTitle);
        }
    }

    /**
     * Sets the current test and starts loading its snapshot file.
     * Loading is async; callers that can wait should `await` the result (or
     * `await snapshotManager.ready()`) before matching.
     *
     * @param {Object} testConfig
     * @param {String} testConfig.testPath full path to the test file
     * @param {String} testConfig.testTitle the full title of the test - all the describe and it names concatenated
     * @returns {Promise<void>}
     */
    setCurrentTest(testConfig) {
        this.currentTest = testConfig;

        if (testConfig && testConfig.testPath) {
            this._pendingSetup = this.client.setup(testConfig.testPath, {
                updateSnapshot: this.willUpdate,
                snapshotEnvironment: this.snapshotEnvironment,
                snapshotFormat: SNAPSHOT_FORMAT,
            });
        }

        return this._pendingSetup;
    }

    /**
     * Resolves once the snapshot file for the current test has been loaded
     * @returns {Promise<void>}
     */
    ready() {
        return this._pendingSetup;
    }

    /**
     * Writes every loaded snapshot file to disk (when changed) and forgets
     * them. Obsolete snapshots are kept, matching the previous jest-snapshot
     * behaviour.
     * @returns {Promise<void>}
     */
    async saveSnapshots() {
        await this._pendingSetup;
        const states = [...this.client.snapshotStateMap.values()];
        this.client.clear();
        await Promise.all(states.map((state) => state.save()));
    }

    /**
     * Asserts the snapshot values match using the match function
     * Does some formatting of the error message
     *
     * @param {{field: string}} response
     * @param {{properties: Object, field: string, error: Object, hint: string}} assertion
     */
    assertSnapshot(response, assertion) {
        const { properties, field, error } = assertion;

        if (!response[field]) {
            error.message = `Unable to match snapshot on undefined field ${field} ${error.contextString}`;
            error.expected = field;
            error.actual = 'undefined';
            assert.notEqual(response[field], undefined, error);
        }

        const hint = assertion.hint || `[${field}]`;
        const match = this.match(response[field], properties, hint);

        if (properties) {
            Object.keys(properties).forEach((prop) => {
                const errorMessage = `"response.${field}" is missing the expected property "${prop}"`;
                error.message = makeMessageFromMatchMessage(match.message(), errorMessage);
                error.expected = prop;
                error.actual = 'undefined';
                error.showDiff = false; // Disable mocha's diff output as it's already present in match.message()

                assert.notEqual(response[field][prop], undefined, error);
            });
        }

        if (match.pass !== true) {
            const errorMessage = `"response.${field}" does not match snapshot.`;
            error.message = makeMessageFromMatchMessage(match.message(), errorMessage);
            error.expected = match.expected;
            error.actual = match.actual;
            error.showDiff = false; // Disable mocha's diff output as it's already present in match.message()
        }

        assert.equal(match.pass, true, error);
    }

    /**
     * Matches `received` against the stored snapshot for the current test.
     * Synchronous: the snapshot file must already be loaded (see setCurrentTest/ready).
     *
     * @param {Object} received - our actual value
     * @param {Object} [properties] - the properties we want to match against
     * @param {string} [hint] - a hint to help with the match
     * @returns {{pass: boolean, message: () => string, actual?: string, expected?: string}}
     */
    match(received, properties = {}, hint) {
        const { testPath, testTitle, snapshotName } = this._getConfig();

        if (!this.client.snapshotStateMap.has(testPath)) {
            throw new errors.IncorrectUsageError({
                message: 'Unable to run snapshot tests, snapshot file was not loaded',
                context: `No snapshot state for ${testPath}`,
                help: 'Await snapshotManager.setCurrentTest() (or snapshotManager.ready()) before matching',
            });
        }

        // Mirror jest's key format: `${currentTestName}: ${hint} ${count}`
        const name = hint ? `${snapshotName}: ${hint}` : snapshotName;
        const failure = (snapshotKey, body, extra) => ({
            pass: false,
            ...extra,
            message: () =>
                `expect(received).toMatchSnapshot()\n\nSnapshot name: \`${snapshotKey}\`\n\n${body}`,
        });

        // Property matchers are checked and merged here rather than by
        // @vitest/snapshot, whose merge copies Any/Anything matchers inside
        // arrays of objects (e.g. `roles: [any(Object)]`) onto the object.
        let value = received;
        if (properties && Object.keys(properties).length) {
            const propertiesPass =
                typeof received === 'object' &&
                received !== null &&
                equals(received, properties, [iterableEquality, subsetEquality]);

            if (!propertiesPass) {
                const body = diff(properties, received, {
                    aAnnotation: 'Expected properties',
                    bAnnotation: 'Received value',
                    includeChangeCounts: true,
                });
                return failure(`${name} 1`, body, { actual: received, expected: properties });
            }

            value = mergeProperties(received, properties);
        }

        const result = this.client.match({
            received: value,
            filepath: testPath,
            name,
            testId: testTitle,
            assertionName: 'toMatchSnapshot',
        });

        if (result.pass) {
            return result;
        }

        const body = diff(result.expected, result.actual, {
            aAnnotation: 'Snapshot',
            bAnnotation: 'Received',
            includeChangeCounts: true,
        });
        return failure(`${name} 1`, body, { actual: result.actual, expected: result.expected });
    }
}

module.exports = SnapshotManager;
