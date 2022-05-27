const {SnapshotState, toMatchSnapshot} = require('jest-snapshot');
const errors = require('@tryghost/errors');
const utils = require('@jest/expect-utils');
const path = require('path');

class SnapshotManager {
    constructor() {
        this.registry = {};
        this.currentTest = {};
        this.defaultSnapshotPath = '__snapshots__';
    }

    _getNameForSnapshot(snapshotFilename, snapshotNameTemplate) {
        if (!this.registry[snapshotFilename]) {
            this.registry[snapshotFilename] = {};
        }

        const nextCounter = (this.registry[snapshotFilename][snapshotNameTemplate] || 0) + 1;
        this.registry[snapshotFilename][snapshotNameTemplate] = nextCounter;

        return `${snapshotNameTemplate} ${nextCounter}`;
    }

    _resolveSnapshotFilePath(testFile) {
        const parsedPath = path.parse(testFile);

        parsedPath.dir = path.join(parsedPath.dir, this.defaultSnapshotPath);

        return path.format(parsedPath);
    }

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

    resetRegistry() {
        this.registry = {};
    }

    setCurrentTest(testConfig) {
        this.currentTest = testConfig;
    }

    getSnapshotState(testFile, willUpdate) {
        // Intilize the SnapshotState, it’s responsible for actually matching
        // actual snapshot with expected one and storing results
        return new SnapshotState(testFile, {
            updateSnapshot: willUpdate
        });
    }

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
        const result = matcher(received, properties, hint);

        // Store the state of snapshot, depending on updateSnapshot value
        snapshotState.save();

        return result;
    }
}

module.exports = SnapshotManager;
