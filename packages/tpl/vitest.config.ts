import { defineConfig, mergeConfig } from 'vitest/config';
import rootConfig from '../../vitest.config';

export default mergeConfig(
    rootConfig,
    defineConfig({
        test: {
            coverage: {
                include: ['lib/**/*.js'],
                exclude: ['**/*.ts', '**/*.d.ts'],
            },
        },
    }),
);
