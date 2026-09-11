/**
 * @description Buffers shipping operations and hands them off in batches
 *
 * Batching trades delivery latency for a much smaller number of requests: the
 * caller gets one round-trip per batch instead of one per metric. Buffered
 * operations are handed off when the buffer reaches `size`, when `maxWaitMs`
 * has elapsed since the first buffered operation, or when `flush()` is called.
 */
class MetricsBatch {
    /**
     * @param {object} options Bag of options
     * @param {number} options.size Number of buffered operations that triggers a hand-off
     * @param {number} options.maxWaitMs How long an operation may sit in the buffer before it is handed off
     * @param {number} options.maxBufferSize Hard cap on buffered operations; further operations are dropped
     * @param {(operations: any[]) => Promise<any>} options.ship Hands a batch of operations to the transport
     */
    constructor({ size, maxWaitMs, maxBufferSize, ship }) {
        this.size = size;
        this.maxWaitMs = maxWaitMs;
        this.maxBufferSize = maxBufferSize;
        this.ship = ship;

        this.buffer = [];
        this.timer = null;
        // Serialises hand-offs, so only one batch is ever in flight
        this.pending = Promise.resolve();
        // A non-zero count means the transport couldn't keep up and metrics
        // were lost; read it off the instance when metrics go missing
        this.dropped = 0;
    }

    /**
     * @description Buffer an operation, handing the buffer off if it is now full
     * @param {any} operation Operation to ship
     */
    add(operation) {
        if (this.buffer.length >= this.maxBufferSize) {
            // Shed load rather than growing without bound when the transport is
            // slow or down: losing metrics beats exhausting the heap
            this.dropped += 1;
            return;
        }

        this.buffer.push(operation);

        // Queue exactly once when the buffer crosses the threshold. `drain()`
        // resets the buffer before awaiting the transport, so the next buffer
        // can independently cross the threshold and line up behind it.
        if (this.buffer.length === this.size) {
            this.flush();
            return;
        }

        this.startTimer();
    }

    /**
     * @description Start the max-wait timer, unless one is already running
     * The timer is unreferenced so a partially full buffer can never hold the
     * event loop - and therefore the process - open.
     */
    startTimer() {
        if (this.timer) {
            return;
        }

        this.timer = setTimeout(() => {
            this.timer = null;
            this.flush();
        }, this.maxWaitMs);

        this.timer.unref?.();
    }

    /**
     * @description Ship everything buffered right now
     * Waits behind any in-flight batch, so batches reach the transport in
     * order and only one request is open at a time.
     * @returns {Promise<void>}
     */
    flush() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }

        const previous = this.pending;

        this.pending = previous.then(() => this.drain());

        return this.pending;
    }

    /**
     * @description Hand the whole buffer to the transport
     * Never rejects, so a failed batch can't poison the hand-off chain or the
     * code path being measured. Transports report their own failures - the
     * Elasticsearch one logs them under the `logging:elasticsearch` debug namespace.
     * @returns {Promise<void>}
     */
    async drain() {
        if (this.buffer.length === 0) {
            return;
        }

        const operations = this.buffer;
        this.buffer = [];

        try {
            await this.ship(operations);
        } catch {
            // Swallowed: a metric call can never break the path it measures
        }
    }
}

module.exports = MetricsBatch;
