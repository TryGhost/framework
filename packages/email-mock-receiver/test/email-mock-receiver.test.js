const assert = require('assert');
const EmailMockReceiver = require('../index');

describe('Email mock receiver', function () {
    it('Runs a test', function () {
        assert.ok(new EmailMockReceiver({snapshotManager: {}}));
    });
});
