const {assert, sinon} = require('./utils');

// We require the root dire
const snapshotTools = require('../');

describe('Jest Snapshot', function () {
    afterEach(function () {
        sinon.restore();
    });

    it('exposes a set of functions', function () {
        assert.deepEqual(Object.keys(snapshotTools), ['mochaHooks', 'snapshotMatcher', 'matchSnapshotAssertion', 'any', 'anything', 'stringMatching']);
    });

    it('matchSnapshotAssertion', function () {
        const matchSnapshotSpy = sinon.stub(snapshotTools.snapshotMatcher, 'matchSnapshot').returns(
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
        const registrySpy = sinon.stub(snapshotTools.snapshotMatcher, 'resetRegistry');
        snapshotTools.mochaHooks.beforeAll();
        sinon.assert.calledOnce(registrySpy);
    });

    it('mochaHooks: beforeEach', function () {
        const setTestSpy = sinon.stub(snapshotTools.snapshotMatcher, 'setCurrentTest').returns();
        snapshotTools.mochaHooks.beforeEach.call({currentTest: {file: 'test', fullTitle: () => { }}});
        sinon.assert.calledOnce(setTestSpy);
    });
});
