const {assert, sinon} = require('./utils');

// We require the root dire
const snapshotTools = require('../');

describe('Jest Snapshot', function () {
    afterEach(function () {
        sinon.restore();
    });

    it('exposes a set of functions', function () {
        assert.deepEqual(Object.keys(snapshotTools), ['mochaHooks', 'snapshotManager', 'matchSnapshotAssertion', 'any', 'anything', 'stringMatching']);

        const {any, anything, stringMatching} = snapshotTools;

        // Check the methods we export from other packages still exist and are
        assert.equal(typeof any, 'function');
        assert.equal(typeof anything, 'function');
        assert.equal(typeof stringMatching, 'function');
    });

    it('matchSnapshotAssertion', function () {
        const matchSnapshotSpy = sinon.stub(snapshotTools.snapshotManager, 'match').returns(
            {
                message: () => { },
                pass: {
                    should: {
                        eql: () => { }
                    }
                }
            }
        );
        const fakeThis = {obj: {foo: 'bar'}, assert: () => {}};
        const fakeProps = {};
        snapshotTools.matchSnapshotAssertion.call(fakeThis, fakeProps);
        sinon.assert.calledOnce(matchSnapshotSpy);
        sinon.assert.calledOnceWithExactly(matchSnapshotSpy, fakeThis.obj, fakeProps);
    });

    it('mochaHooks: beforeAll', function () {
        const registrySpy = sinon.stub(snapshotTools.snapshotManager, 'resetRegistry');
        snapshotTools.mochaHooks.beforeAll();
        sinon.assert.calledOnce(registrySpy);
    });

    it('mochaHooks: beforeEach', function () {
        const setTestSpy = sinon.stub(snapshotTools.snapshotManager, 'setCurrentTest').returns();
        snapshotTools.mochaHooks.beforeEach.call({currentTest: {file: 'test', fullTitle: () => { }, currentRetry: () => 0}});
        sinon.assert.calledOnce(setTestSpy);
    });

    it('mochaHooks: beforeEach with retries', function () {
        const setTestSpy = sinon.stub(snapshotTools.snapshotManager, 'setCurrentTest').returns();
        const resetRegistrySpy = sinon.stub(snapshotTools.snapshotManager, 'resetRegistryForCurrentTest').returns();
        snapshotTools.mochaHooks.beforeEach.call({currentTest: {file: 'test', fullTitle: () => { }, currentRetry: () => 0}});
        snapshotTools.mochaHooks.beforeEach.call({currentTest: {file: 'test', fullTitle: () => { }, currentRetry: () => 1}});
        sinon.assert.calledTwice(setTestSpy);
        sinon.assert.calledOnce(resetRegistrySpy);
    });
});
