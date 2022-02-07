const {SnapshotState, toMatchSnapshot} = require('jest-snapshot');
const expect = require('expect');
const utils = require('expect/build/utils');

class SnapshotManageer {
    constructor() {
        this.registry = {};
        this.currentTest = {};
    }

    _getNameForSnapshot(snapshotFilename, snapshotNameTemplate) {
        if (!this.registry[snapshotFilename]) {
            this.registry[snapshotFilename] = {};
        }

        const nextCounter = (this.registry[snapshotFilename][snapshotNameTemplate] || 0) + 1;
        this.registry[snapshotFilename][snapshotNameTemplate] = nextCounter;

        return `${snapshotNameTemplate} ${nextCounter}`;
    }

    _getConfig() {
        const testFile = this.currentTest.filename;
        const testTitle = this.currentTest.nameTemplate;
        const snapshotName = this._getNameForSnapshot(testFile, testTitle);
        const willUpdate = process.env.SNAPSHOT_UPDATE ? 'all' : 'new';

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

    match(received, properties = {}) {
        const {testFile, snapshotName, willUpdate} = this._getConfig();

        const snapshotState = this.getSnapshotState(testFile, willUpdate);
        // Equals is not exposed from the internals of expect
        // This truly bananananas workaround comes from here: https://github.com/facebook/jest/issues/11867
        let equals = () => {};
        expect.extend({
            __capture_equals__() {
                equals = this.equals;
                return {pass: true};
            }
        });
        expect().__capture_equals__();

        const matcher = toMatchSnapshot.bind({
            snapshotState,
            currentTestName: snapshotName,
            utils,
            equals
        });

        // Execute the matcher
        const result = matcher(received, properties);

        // Store the state of snapshot, depending on updateSnapshot value
        snapshotState.save();

        return result;
    }
}

module.exports = SnapshotManageer;
