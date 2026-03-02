import {defineConfig, mergeConfig} from 'vitest/config';
import rootConfig from '../../vitest.config';

// Override: setupFiles needed to initialize the snapshot test registry
// before each test. Coverage was never enforced under Mocha.
export default mergeConfig(rootConfig, defineConfig({
    test: {
        setupFiles: ['./test/utils/overrides.js'],
        coverage: {
            thresholds: {
                lines: 0,
                functions: 0,
                branches: 0,
                statements: 0
            }
        }
    }
}));
