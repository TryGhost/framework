const { Any, Anything, StringMatching } = require('@vitest/expect');
const SnapshotManager = require('./SnapshotManager');
const snapshotManager = new SnapshotManager();

function matchSnapshotAssertion(properties) {
    this.params = { operator: 'to match a stored snapshot' };

    const result = snapshotManager.match(this.obj, properties);

    this.params.message = result.message();
    this.assert(result.pass === true);
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
    async beforeEach() {
        const { currentTest } = this;

        if (currentTest.currentRetry() > 0) {
            // Reset registry for this test only
            snapshotManager.resetRegistryForCurrentTest();
        }

        await snapshotManager.setCurrentTest({
            testPath: currentTest.file,
            testTitle: currentTest.fullTitle(),
        });
    },

    /**
     * Runs after all tests
     * Writes new/updated snapshots to disk
     */
    async afterAll() {
        await snapshotManager.saveSnapshots();
    },
};

// Same shape as jest's expect.any / expect.anything / expect.stringMatching
const any = (sample) => new Any(sample);
const anything = () => new Anything();
const stringMatching = (expected) => new StringMatching(expected);

module.exports = {
    mochaHooks,
    snapshotManager,
    matchSnapshotAssertion,
    any,
    anything,
    stringMatching,
};
