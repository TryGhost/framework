import assert from 'assert/strict';
import {
    UnavailableAnomaly,
    InterruptedAnomaly,
    BusyAnomaly,
    IncorrectAnomaly,
    ForbiddenAnomaly,
    UnsupportedAnomaly,
    NotFoundAnomaly,
    ConflictAnomaly,
    FaultAnomaly,
    isAnomaly
} from '../src/index';

describe('Anomalies', function () {
    describe('Specific anomaly classes', function () {
        it('should create UnavailableAnomaly correctly', function () {
            const anomaly = new UnavailableAnomaly();
            assert.equal(anomaly.category, 'unavailable');
            assert.equal(anomaly.message, 'Service is unavailable');
            assert.equal(anomaly.retryable, true);
        });

        it('should create InterruptedAnomaly correctly', function () {
            const anomaly = new InterruptedAnomaly('Custom interrupted message');
            assert.equal(anomaly.category, 'interrupted');
            assert.equal(anomaly.message, 'Custom interrupted message');
            assert.equal(anomaly.retryable, false);
        });

        it('should create BusyAnomaly correctly', function () {
            const anomaly = new BusyAnomaly();
            assert.equal(anomaly.category, 'busy');
            assert.equal(anomaly.retryable, true);
        });

        it('should create IncorrectAnomaly correctly', function () {
            const anomaly = new IncorrectAnomaly();
            assert.equal(anomaly.category, 'incorrect');
            assert.equal(anomaly.retryable, false);
        });

        it('should create ForbiddenAnomaly correctly', function () {
            const anomaly = new ForbiddenAnomaly();
            assert.equal(anomaly.category, 'forbidden');
            assert.equal(anomaly.retryable, false);
        });

        it('should create UnsupportedAnomaly correctly', function () {
            const anomaly = new UnsupportedAnomaly();
            assert.equal(anomaly.category, 'unsupported');
            assert.equal(anomaly.retryable, false);
        });

        it('should create NotFoundAnomaly correctly', function () {
            const anomaly = new NotFoundAnomaly();
            assert.equal(anomaly.category, 'not-found');
            assert.equal(anomaly.retryable, false);
        });

        it('should create ConflictAnomaly correctly', function () {
            const anomaly = new ConflictAnomaly();
            assert.equal(anomaly.category, 'conflict');
            assert.equal(anomaly.retryable, false);
        });

        it('should create FaultAnomaly correctly', function () {
            const anomaly = new FaultAnomaly();
            assert.equal(anomaly.category, 'fault');
            assert.equal(anomaly.retryable, false);
        });
    });

    describe('isAnomaly function', function () {
        it('should return true for anomaly instances', function () {
            const anomaly = new UnavailableAnomaly();
            assert.equal(isAnomaly(anomaly), true);
        });

        it('should return false for regular errors', function () {
            const error = new Error('Regular error');
            assert.equal(isAnomaly(error), false);
        });

        it('should return false for non-error objects', function () {
            assert.equal(isAnomaly({}), false);
            assert.equal(isAnomaly(null), false);
            assert.equal(isAnomaly(undefined), false);
        });
    });


    describe('Edge cases', function () {
        it('should use default messages when no custom message provided', function () {
            const anomaly = new UnavailableAnomaly();
            assert.equal(anomaly.message, 'Service is unavailable');
        });

        it('should test all anomaly types with custom messages', function () {
            const customMessage = 'Custom test message';
            const anomalies = [
                new UnavailableAnomaly(customMessage),
                new InterruptedAnomaly(customMessage),
                new BusyAnomaly(customMessage),
                new IncorrectAnomaly(customMessage),
                new ForbiddenAnomaly(customMessage),
                new UnsupportedAnomaly(customMessage),
                new NotFoundAnomaly(customMessage),
                new ConflictAnomaly(customMessage),
                new FaultAnomaly(customMessage)
            ];

            anomalies.forEach((anomaly) => {
                assert.equal(anomaly.message, customMessage);
            });
        });

        it('should allow overriding retryable for InterruptedAnomaly', function () {
            const defaultInterrupted = new InterruptedAnomaly();
            assert.equal(defaultInterrupted.retryable, false);

            const retryableInterrupted = new InterruptedAnomaly('Custom message', true);
            assert.equal(retryableInterrupted.retryable, true);

            const nonRetryableInterrupted = new InterruptedAnomaly('Custom message', false);
            assert.equal(nonRetryableInterrupted.retryable, false);
        });

        it('should allow overriding retryable for FaultAnomaly', function () {
            const defaultFault = new FaultAnomaly();
            assert.equal(defaultFault.retryable, false);

            const retryableFault = new FaultAnomaly('Custom message', true);
            assert.equal(retryableFault.retryable, true);

            const nonRetryableFault = new FaultAnomaly('Custom message', false);
            assert.equal(nonRetryableFault.retryable, false);
        });

        it('should not allow overriding retryable for anomalies without retryable parameter', function () {
            // These should always maintain their default retryable values
            const unavailable = new UnavailableAnomaly();
            assert.equal(unavailable.retryable, true);

            const busy = new BusyAnomaly();
            assert.equal(busy.retryable, true);

            const incorrect = new IncorrectAnomaly();
            assert.equal(incorrect.retryable, false);

            const forbidden = new ForbiddenAnomaly();
            assert.equal(forbidden.retryable, false);

            const unsupported = new UnsupportedAnomaly();
            assert.equal(unsupported.retryable, false);

            const notFound = new NotFoundAnomaly();
            assert.equal(notFound.retryable, false);

            const conflict = new ConflictAnomaly();
            assert.equal(conflict.retryable, false);
        });
    });
});
