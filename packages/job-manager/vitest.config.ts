import {defineConfig, mergeConfig} from 'vitest/config';
import rootConfig from '../../vitest.config';

// Override: Bree spawns background workers that emit unhandled rejections
// during cleanup after tests complete. These are expected and were silently
// ignored by Mocha.
export default mergeConfig(rootConfig, defineConfig({
    test: {
        dangerouslyIgnoreUnhandledErrors: true
    }
}));
