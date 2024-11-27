const {jestExpect} = require('@jest/expect');
const SnapshotManager = require('./SnapshotManager');
const snapshotManager = new SnapshotManager();

function matchSnapshotAssertion(properties) {
    this.params = {operator: 'to match a stored snapshot'};

    const result = snapshotManager.match(this.obj, properties);

    this.params.message = result.message();
    this.assert(result.pass.should.eql(true));
}

const mochaHooks = {

    /**
     * Runs before all tests
     * Resets the registry so we start with a clean slate
     */
    beforeAll() {
        snapshotManager.resetRegistry();
    },

    /**
     * Runs before each test
     * Passes the current test config to the snapshot manager
     * If we're running a retry, reset the registry for this test only
     */
    beforeEach() {
        const {currentTest} = this;

        if (currentTest.currentRetry() > 0) {
            // Reset registry for this test only
            snapshotManager.resetRegistryForCurrentTest();
        }

        snapshotManager.setCurrentTest({
            filename: currentTest.file + '.snap',
            nameTemplate: currentTest.fullTitle()
        });
    }
};

const {any, anything, stringMatching} = jestExpect;

module.exports = {
    mochaHooks,
    snapshotManager,
    matchSnapshotAssertion,
    any,
    anything,
    stringMatching
};
