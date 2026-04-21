const { snapshotManager } = require('@tryghost/jest-snapshot');
const SNAPSHOT_ROOT = '__jest_snapshots__';
beforeAll(() => {
    // Keep custom jest-snapshot files out of Vitest's native __snapshots__ discovery.
    snapshotManager.defaultSnapshotRoot = SNAPSHOT_ROOT;
    snapshotManager.resetRegistry();
});

beforeEach((context) => {
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
        testTitle: parts.join(' '),
    });
});
