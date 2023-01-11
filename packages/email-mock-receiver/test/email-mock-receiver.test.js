const assert = require('assert');
const sinon = require('sinon');

const EmailMockReceiver = require('../index');

describe('Email mock receiver', function () {
    let snapshotManager;
    let emailMockReceiver;

    before(function () {
        snapshotManager = {
            assertSnapshot: sinon.spy()
        };

        emailMockReceiver = new EmailMockReceiver({snapshotManager});
    });

    afterEach(function () {
        sinon.reset();
        emailMockReceiver.reset();
    });

    it('Can initialize', function () {
        assert.ok(new EmailMockReceiver({snapshotManager: {}}));
    });

    describe('matchHTMLSnapshot', function () {
        it('Can match primitive HTML snapshot', function () {
            emailMockReceiver.send({html: '<div>test</div>'});
            emailMockReceiver.matchHTMLSnapshot();

            assert.equal(snapshotManager.assertSnapshot.calledOnce, true);
            assert.deepEqual(snapshotManager.assertSnapshot.args[0][0], {
                html: '<div>test</div>'
            });
        });

        it('Can match first HTML snapshot with multiple send requests are executed', function () {
            emailMockReceiver = new EmailMockReceiver({snapshotManager});

            emailMockReceiver.send({html: '<div>test 1</div>'});
            emailMockReceiver.send({html: '<div>test 2</div>'});

            emailMockReceiver.matchHTMLSnapshot();

            assert.equal(snapshotManager.assertSnapshot.calledOnce, true);
            assert.deepEqual(snapshotManager.assertSnapshot.args[0][0], {
                html: '<div>test 1</div>'
            });
        });
    });
});
