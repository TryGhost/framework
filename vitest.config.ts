import {defineConfig} from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['test/**/*.test.{js,ts}'],
        pool: 'threads',
        coverage: {
            provider: 'v8',
            include: ['**/lib/**'],
            exclude: ['**/src/**', '**/build/**', '**/test/**'],
            reporter: ['text', 'cobertura'],
            thresholds: {
                lines: 90,
                functions: 90,
                branches: 80,
                statements: 90
            }
        }
    }
});
