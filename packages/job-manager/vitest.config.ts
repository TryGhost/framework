import {defineConfig} from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['test/**/*.test.{js,ts}'],
        // Job manager tests spawn background workers that emit unhandled
        // rejections after the test completes (e.g. bree job cleanup).
        // These are expected and were silently ignored by Mocha.
        dangerouslyIgnoreUnhandledErrors: true,
        coverage: {
            provider: 'v8',
            all: true,
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
