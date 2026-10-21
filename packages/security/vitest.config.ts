import { defineConfig, mergeConfig } from 'vitest/config';
import rootConfig from '../../vitest.config';

export default mergeConfig(
    rootConfig,
    defineConfig({
        test: {
            coverage: {
                // Measure the compiled JavaScript exercised by tests and shipped to consumers.
                include: ['lib/**/*.js'],
                exclude: ['**/*.ts', '**/*.d.ts'],
            },
        },
    }),
);
