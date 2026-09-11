/**
 * Buffers shipping operations and hands them off in batches.
 *
 * Batching trades delivery latency for a much smaller number of requests.
 * Buffered operations are handed off when the buffer reaches `size`, when
 * `maxWaitMs` has elapsed since the first buffered operation, or when
 * {@link MetricsBatch.flush} is called.
 */
declare class MetricsBatch<T = unknown> {
    /** Number of buffered operations that triggers a hand-off. */
    size: number;
    /** How long an operation may sit in the buffer before it is handed off, in milliseconds. */
    maxWaitMs: number;
    /** Hard cap on buffered operations; further operations are dropped. */
    maxBufferSize: number;
    /** Hands a batch of operations to the transport. */
    ship: (operations: T[]) => Promise<unknown>;
    /** Operations waiting to be shipped. */
    buffer: T[];
    /** Count of operations dropped because the buffer was full. */
    dropped: number;

    constructor(options: {
        size: number;
        maxWaitMs: number;
        maxBufferSize: number;
        ship: (operations: T[]) => Promise<unknown>;
    });

    /**
     * Buffer an operation, handing the buffer off if it is now full. Operations
     * arriving once the buffer is at `maxBufferSize` are dropped.
     */
    add(operation: T): void;

    /** Start the max-wait timer, unless one is already running. */
    startTimer(): void;

    /**
     * Ship everything buffered right now, waiting behind any in-flight batch.
     * Never rejects.
     */
    flush(): Promise<void>;

    /** Hand the whole buffer to the transport. Never rejects. */
    drain(): Promise<void>;
}

export = MetricsBatch;
