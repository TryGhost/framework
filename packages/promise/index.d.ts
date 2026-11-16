type Task<T = unknown> = (...args: any[]) => T | Promise<T>;

/**
 * Run tasks one after another, passing each task's result as the arguments of
 * the next (arrays are spread). The initial arguments may be promises.
 * Resolves to the last task's result.
 */
export declare function pipeline(tasks: Task[], ...args: unknown[]): Promise<any>;

/**
 * Run tasks one after another, each called with the same arguments.
 * Resolves to the results in input order.
 */
export declare function sequence<T>(tasks: Array<Task<T>>, ...args: unknown[]): Promise<T[]>;

/**
 * Run tasks with at most `maxConcurrent` running at once.
 * Resolves to the results in input order.
 */
export declare function pool<T>(
    tasks: Array<() => T | Promise<T>>,
    maxConcurrent: number,
): Promise<T[]>;
