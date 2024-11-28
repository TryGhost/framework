const {SnapshotState, toMatchSnapshot, EXTENSION} = require('jest-snapshot');
const errors = require('@tryghost/errors');
const utils = require('@jest/expect-utils');
const assert = require('assert');
const path = require('path');
const {makeMessageFromMatchMessage} = require('./utils');

const DOT_EXTENSION = `.${EXTENSION}`;

class SnapshotManager {
    constructor() {
        this.registry = {};
        this.currentTest = {};
        this.defaultSnapshotRoot = '__snapshots__';
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
            path.basename(testPath) + DOT_EXTENSION
        );
    }

    /**
     * Returns config for the current test
     * Throws an error if the current test is not configured
     * @returns {Object} e.g. {snapshotPath: 'test/__snapshots__/my-fake.test.js.snap', snapshotName: 'My fake test title 1', willUpdate: 'new'}
     */
    _getConfig() {
        if (!this.currentTest.testPath || !this.currentTest.testTitle) {
            throw new errors.IncorrectUsageError({
                message: 'Unable to run snapshot tests, current test was not configured',
                context: 'Snapshot testing requires current test filename and nameTemplate to be set for each test',
                help: 'Did you forget to do export.mochaHooks?'
            });
        }

        const {testPath, testTitle} = this.currentTest;

        const snapshotName = this._getNameForSnapshot(testPath, testTitle);
        const updateSnapshots = (
            process.env.SNAPSHOT_UPDATE
            || process.env.UPDATE_SNAPSHOT
            || process.env.SNAPSHOTS_UPDATE
            || process.env.UPDATE_SNAPSHOTS
        );
        const willUpdate = updateSnapshots ? 'all' : 'new';

        // Set full path
        const snapshotPath = this._resolveSnapshotFilePath(testPath);

        return {snapshotPath, snapshotName, willUpdate};
    }

    /**
     * Resets the registry to an empty object
     */
    resetRegistry() {
        this.registry = {};
    }

    /**
     * Resets the registry for the current test only
     */
    resetRegistryForCurrentTest() {
        const {testPath, testTitle} = this.currentTest;
        if (testPath in this.registry && testTitle in this.registry[testPath]) {
            delete this.registry[testPath][testTitle];
        }
    }

    /**
     * @param {Object} testConfig
     * @param {String} testConfig.testPath full path to the test file
     * @param {String} testConfig.testTitle the full title of the test - all the describe and it names concatenated
     */
    setCurrentTest(testConfig) {
        this.currentTest = testConfig;
    }

    /**
     * Gets a SnapshotState instance for the current test
     * @param {string} snapshotPath e.g. 'test/__snapshots__/my-fake.test.js.snap'
     * @param {string} willUpdate e.g. 'new'
     * @returns {SnapshotState}
     */
    getSnapshotState(snapshotPath, willUpdate) {
        // Initialize the SnapshotState, it’s responsible for actually matching
        // actual snapshot with expected one and storing results
        return new SnapshotState(snapshotPath, {
            updateSnapshot: willUpdate
        });
    }

    /**
     * Asserts the snapshot values match using the match function
     * Does some formatting of the error message
     *
     * @param {{field: string}} response
     * @param {{properties: Object, field: string, error: Object, hint: string}} assertion
     */
    assertSnapshot(response, assertion) {
        const {properties, field, error} = assertion;

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
     * Calls Jest's toMatchSnapshot function
     * Binds the snapshotState, currentTestName, utils and equals function to the matcher
     * Executes the matcher
     * Saves the snapshot state
     *
     * @param {Object} received - our actual value
     * @param {Object} [properties] - the properties we want to match against
     * @param {string} [hint] - a hint to help with the match
     * @returns {Object} result of the match
     */
    match(received, properties = {}, hint) {
        const {snapshotPath, snapshotName, willUpdate} = this._getConfig();

        const snapshotState = this.getSnapshotState(snapshotPath, willUpdate);
        const matcher = toMatchSnapshot.bind({
            snapshotState,
            currentTestName: snapshotName,
            utils,
            equals: utils.equals
        });

        // Execute the matcher
        let result;
        if (properties) {
            result = matcher(received, properties, hint);
        } else {
            result = matcher(received, hint);
        }

        // Store the state of snapshot, depending on updateSnapshot value
        snapshotState.save();

        return result;
    }
}

module.exports = SnapshotManager;
