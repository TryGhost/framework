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
        this.defaultSnapshotPath = '__snapshots__';
    }

    /**
     * Looks in the registry for a snapshot with the same filename and nameTemplate
     * If needed, increments the counter
     * Returns nametemplate with the counter appended.
     *
     * @param {string} snapshotFilename e.g. 'my-fake.test.js.snap'
     * @param {string} snapshotNameTemplate e.g. 'My fake test title'
     * @returns {string} e.g. 'My fake test title 1'
     */
    _getNameForSnapshot(snapshotFilename, snapshotNameTemplate) {
        if (!this.registry[snapshotFilename]) {
            this.registry[snapshotFilename] = {};
        }

        const nextCounter = (this.registry[snapshotFilename][snapshotNameTemplate] || 0) + 1;
        this.registry[snapshotFilename][snapshotNameTemplate] = nextCounter;

        return `${snapshotNameTemplate} ${nextCounter}`;
    }

    /**
     * Takes the full path to the test file and returns the full path to the snapshot file
     *
     * @param {string} testFile e.g. '/path/to/tests/my-fake.test.js'
     * @returns {string} e.g. '/path/to/tests/__snapshots__/my-fake.test.js.snap'
     */
    _resolveSnapshotFilePath(testFile) {
        return path.join(
            path.join(path.dirname(testFile), this.defaultSnapshotPath),
            path.basename(testFile) + DOT_EXTENSION
        );
    }

    /**
     * Returns config for the current test
     * Throws an error if the current test is not configured
     * @returns {Object} e.g. {testFile: '__snapshots__/my-fake.test.js.snap', snapshotName: 'My fake test title 1', willUpdate: 'new'}
     */
    _getConfig() {
        if (!this.currentTest.filename || !this.currentTest.nameTemplate) {
            throw new errors.IncorrectUsageError({
                message: 'Unable to run snapshot tests, current test was not configured',
                context: 'Snapshot testing requires current test filename and nameTemplate to be set for each test',
                help: 'Did you forget to do export.mochaHooks?'
            });
        }

        let testFile = this.currentTest.filename;
        const testTitle = this.currentTest.nameTemplate;
        const snapshotName = this._getNameForSnapshot(testFile, testTitle);
        const updateSnapshots = (
            process.env.SNAPSHOT_UPDATE
            || process.env.UPDATE_SNAPSHOT
            || process.env.SNAPSHOTS_UPDATE
            || process.env.UPDATE_SNAPSHOTS
        );
        const willUpdate = updateSnapshots ? 'all' : 'new';

        // Set full path
        testFile = this._resolveSnapshotFilePath(testFile);

        return {testFile, snapshotName, willUpdate};
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
        const testTitle = this.currentTest.nameTemplate;
        if (this.currentTest.filename in this.registry && testTitle in this.registry[this.currentTest.filename]) {
            delete this.registry[this.currentTest.filename][testTitle];
        }
    }

    /**
     * @param {Object} testConfig
     * @param {String} testConfig.filename full path to the test file
     * @param {String} testConfig.nameTemplate the full name of the test - all the describe and it names concatenated
     */
    setCurrentTest(testConfig) {
        this.currentTest = testConfig;
    }

    /**
     * Gets a SnapshotState instance for the current test
     * @param {string} testFile e.g. '__snapshots__/my-fake.test.js.snap'
     * @param {string} willUpdate e.g. 'new'
     * @returns {SnapshotState}
     */
    getSnapshotState(testFile, willUpdate) {
        // Initialize the SnapshotState, it’s responsible for actually matching
        // actual snapshot with expected one and storing results
        return new SnapshotState(testFile, {
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
        const {testFile, snapshotName, willUpdate} = this._getConfig();

        const snapshotState = this.getSnapshotState(testFile, willUpdate);
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
