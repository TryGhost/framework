import rootConfig from '../../vitest.config';

// Keep unhandled errors fatal for this package. Worker fixtures should clean up
// without leaking rejections, and CI should catch regressions instead of
// matching Mocha's old silent behavior.
export default rootConfig;
