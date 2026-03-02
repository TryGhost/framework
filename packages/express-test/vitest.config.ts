import {defineConfig, mergeConfig} from 'vitest/config';
import rootConfig from '../../vitest.config';

// Override: setupFiles needed to initialize the snapshot test registry
// before each test (replaces Mocha's --require flag).
export default mergeConfig(rootConfig, defineConfig({
    test: {
        setupFiles: ['./test/utils/overrides.js']
    }
}));
