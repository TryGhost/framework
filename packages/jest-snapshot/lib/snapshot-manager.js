const {SnapshotState, toMatchSnapshot} = require('jest-snapshot');
const errors = require('@tryghost/errors');
const expect = require('expect');
const utils = require('expect/build/utils');
const path = require('path');

class SnapshotManageer {
    constructor() {
        this.registry = {};
        this.currentTest = {};
        this.defaultTestPath = 'test';
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
        const willUpdate = process.env.SNAPSHOT_UPDATE ? 'all' : 'new';

        // Set full path
        const testPath = path.resolve(this.defaultTestPath);
        const snapshotPath = path.join(testPath, this.defaultSnapshotPath);

        testFile = testFile.replace(testPath, snapshotPath);

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
        // Equals is not exposed from the internals of expect
        // This truly bananananas workaround comes from here: https://github.com/facebook/jest/issues/11867
        let equals = null;
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
        const result = matcher(received, properties, hint);

        // Store the state of snapshot, depending on updateSnapshot value
        snapshotState.save();

        return result;
    }
}

module.exports = SnapshotManageer;
