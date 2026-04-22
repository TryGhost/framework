import { defineConfig, mergeConfig } from 'vitest/config';
import rootConfig from '../../vitest.config';

// Override: tests use process.chdir(), which is not available in worker_threads.
export default mergeConfig(
    rootConfig,
    defineConfig({
        test: {
            pool: 'forks',
        },
    }),
);
