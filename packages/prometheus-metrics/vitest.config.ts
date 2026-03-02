import {defineConfig} from 'vitest/config';

// Override: TypeScript package with source in src/, not lib/.
// Coverage must be scoped to src/ to measure the right files.
export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['test/**/*.test.{js,ts}'],
        coverage: {
            provider: 'v8',
            all: true,
            include: ['src/**'],
            reporter: ['text', 'cobertura'],
            thresholds: {
                lines: 90,
                functions: 90,
                branches: 90,
                statements: 90
            }
        }
    }
});
