const expect = require('expect');
const SnapshotManager = require('./snapshot-manager');
const snapshotManager = new SnapshotManager();

function matchSnapshotAssertion(properties) {
    this.params = {operator: 'to match a stored snapshot'};

    const result = snapshotManager.match(this.obj, properties);

    this.params.message = result.message();
    this.assert(result.pass.should.eql(true));
}

const mochaHooks = {
    beforeAll() {
        snapshotManager.resetRegistry();
    },
    beforeEach() {
        const {currentTest} = this;

        snapshotManager.setCurrentTest({
            filename: currentTest.file + '.snap',
            nameTemplate: currentTest.fullTitle()
        });
    }
};

const {any, anything, stringMatching} = expect;

module.exports = {
    mochaHooks,
    snapshotManager,
    matchSnapshotAssertion,
    any,
    anything,
    stringMatching
};
