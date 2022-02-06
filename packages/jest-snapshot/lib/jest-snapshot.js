const {SnapshotState, toMatchSnapshot} = require('jest-snapshot');
const expect = require('expect');
const utils = require('expect/build/utils');

let snapshotNameRegistry = {};

const snapshotConfig = {};

const getNameForSnapshot = (snapshotFilename, snapshotNameTemplate) => {
    if (!snapshotNameRegistry[snapshotFilename]) {
        snapshotNameRegistry[snapshotFilename] = {};
    }

    const nextCounter = (snapshotNameRegistry[snapshotFilename][snapshotNameTemplate] || 0) + 1;
    snapshotNameRegistry[snapshotFilename][snapshotNameTemplate] = nextCounter;

    return `${snapshotNameTemplate} ${nextCounter}`;
};

const getConfig = () => {
    const testFile = snapshotConfig.snapshotFilename;
    const testTitle = snapshotConfig.snapshotNameTemplate;
    const snapshotName = getNameForSnapshot(testFile, testTitle);
    const willUpdate = process.env.SNAPSHOT_UPDATE ? 'all' : 'new';

    return {testFile, snapshotName, willUpdate};
};

function matchSnapshotAssertion(properties) {
    this.params = {operator: 'to match a stored snapshot'};

    const result = matchSnapshot(this.obj, properties);

    this.params.message = result.message();
    this.assert(result.pass.should.eql(true));
}

function matchSnapshot(received, properties = {}) {
    const {testFile, snapshotName, willUpdate} = getConfig();

    // Intilize the SnapshotState, it’s responsible for actually matching
    // actual snapshot with expected one and storing results
    const snapshotState = new SnapshotState(testFile, {
        updateSnapshot: willUpdate
    });

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

const mochaHooks = {
    beforeAll() {
        snapshotNameRegistry = {};
    },
    beforeEach() {
        const {currentTest} = this;

        snapshotConfig.snapshotFilename = currentTest.file + '.snap';
        snapshotConfig.snapshotNameTemplate = currentTest.fullTitle();
    }
};

const {any, anything, stringMatching} = expect;

module.exports = {
    mochaHooks,
    matchSnapshot,
    matchSnapshotAssertion,
    any,
    anything,
    stringMatching
};
