import {defineConfig, mergeConfig} from 'vitest/config';
import rootConfig from '../../vitest.config';

// Override: TypeScript package with source in src/, not lib/.
// Coverage must be scoped to src/ to measure the right files.
export default mergeConfig(rootConfig, defineConfig({
    test: {
        coverage: {
            include: ['src/**']
        }
    }
}));
