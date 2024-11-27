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

        // Check the methods we export from other packages still exist and are functions
        assert.equal(typeof any, 'function');
        assert.equal(typeof anything, 'function');
        assert.equal(typeof stringMatching, 'function');
    });

    it('matchSnapshotAssertion calls the match function and asserts the result', function () {
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

    describe('mochaHooks', function () {
        it('beforeAll correctly resets the registry', function () {
            const registrySpy = sinon.stub(snapshotTools.snapshotManager, 'resetRegistry');
            snapshotTools.mochaHooks.beforeAll();
            sinon.assert.calledOnce(registrySpy);
        });

        it('beforeEach correctly sets the current test', function () {
            const setTestSpy = sinon.stub(snapshotTools.snapshotManager, 'setCurrentTest').returns();
            snapshotTools.mochaHooks.beforeEach.call({currentTest: {file: 'test', fullTitle: () => { }, currentRetry: () => 0}});
            sinon.assert.calledOnce(setTestSpy);
        });

        it('beforeEach with retries correctly resets the registry for the current test', function () {
            const setTestSpy = sinon.stub(snapshotTools.snapshotManager, 'setCurrentTest').returns();
            const resetRegistrySpy = sinon.stub(snapshotTools.snapshotManager, 'resetRegistryForCurrentTest').returns();
            snapshotTools.mochaHooks.beforeEach.call({currentTest: {file: 'test', fullTitle: () => { }, currentRetry: () => 0}});
            snapshotTools.mochaHooks.beforeEach.call({currentTest: {file: 'test', fullTitle: () => { }, currentRetry: () => 1}});
            sinon.assert.calledTwice(setTestSpy);
            sinon.assert.calledOnce(resetRegistrySpy);
        });
    });
});
