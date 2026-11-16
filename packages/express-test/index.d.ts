import AgentClass = require('./lib/Agent');
import jestSnapshot = require('@tryghost/jest-snapshot');

/**
 * The `Agent` class, with `@tryghost/jest-snapshot` attached as `snapshot`.
 */
declare class Agent extends AgentClass {}

declare namespace Agent {
    type AgentOptions = AgentClass.AgentOptions;
    type App = AgentClass.App;
    type Response = AgentClass.Response;
    type CookieJar = AgentClass.CookieJar;
    type Cookie = AgentClass.Cookie;
    type CookieAccessInfo = AgentClass.CookieAccessInfo;
    type HeaderValue = AgentClass.HeaderValue;
    type SnapshotManager = AgentClass.SnapshotManager;
    type Assertion = AgentClass.Assertion;
    type SnapshotAssertion = AgentClass.SnapshotAssertion;
    type ExpectRequest = AgentClass.ExpectRequest;

    /**
     * `@tryghost/jest-snapshot`, re-exported so tests use the same copy as
     * express-test.
     */
    const snapshot: {
        mochaHooks: typeof jestSnapshot.mochaHooks;
        snapshotManager: typeof jestSnapshot.snapshotManager;
        matchSnapshotAssertion: typeof jestSnapshot.matchSnapshotAssertion;
        any: typeof jestSnapshot.any;
        stringMatching: typeof jestSnapshot.stringMatching;
    };
}

export = Agent;
