const {snapshotManager} = require('@tryghost/jest-snapshot');

/* eslint-disable ghost/mocha/no-mocha-arrows, ghost/mocha/no-top-level-hooks, ghost/mocha/handle-done-callback */
beforeAll(() => { // eslint-disable-line no-undef
    snapshotManager.resetRegistry();
});

beforeEach((context) => { // eslint-disable-line no-undef
    // Reconstruct full title similar to mocha's fullTitle()
    const parts = [];
    let suite = context.task.suite;
    while (suite && suite.name) {
        parts.unshift(suite.name);
        suite = suite.suite;
    }
    parts.push(context.task.name);

    snapshotManager.setCurrentTest({
        testPath: context.task.file.filepath,
        testTitle: parts.join(' ')
    });
});
