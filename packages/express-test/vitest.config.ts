import {defineConfig} from 'vitest/config';

// Override: setupFiles needed to initialize the snapshot test registry
// before each test. Coverage was never enforced under Mocha.
export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['test/**/*.test.{js,ts}'],
        setupFiles: ['./test/utils/overrides.js'],
        coverage: {
            provider: 'v8',
            all: true,
            reporter: ['text', 'cobertura'],
            thresholds: {
                lines: 0,
                functions: 0,
                branches: 0,
                statements: 0
            }
        }
    }
});
