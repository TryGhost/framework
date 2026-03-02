import {defineConfig, mergeConfig} from 'vitest/config';
import rootConfig from '../../vitest.config';

// Override: coverage was never enforced under Mocha.
export default mergeConfig(rootConfig, defineConfig({
    test: {
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
