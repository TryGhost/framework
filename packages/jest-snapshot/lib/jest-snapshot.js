const expect = require('expect');
const SnapshotMatcher = require('./snapshot-matcher');
const snapshotMatcher = new SnapshotMatcher();

function matchSnapshotAssertion(properties) {
    this.params = {operator: 'to match a stored snapshot'};

    const result = snapshotMatcher.matchSnapshot(this.obj, properties);

    this.params.message = result.message();
    this.assert(result.pass.should.eql(true));
}

const mochaHooks = {
    beforeAll() {
        snapshotMatcher.resetRegistry();
    },
    beforeEach() {
        const {currentTest} = this;

        snapshotMatcher.setCurrentTest({
            filename: currentTest.file + '.snap',
            nameTemplate: currentTest.fullTitle()
        });
    }
};

const {any, anything, stringMatching} = expect;

module.exports = {
    mochaHooks,
    snapshotMatcher,
    matchSnapshot: snapshotMatcher.matchSnapshot,
    matchSnapshotAssertion,
    any,
    anything,
    stringMatching
};
