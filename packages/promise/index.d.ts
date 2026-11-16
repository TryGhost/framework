type Task = (...args: any[]) => unknown;

/**
 * Run tasks one after another, passing each task's result as the arguments of
 * the next (arrays are spread). The initial arguments may be promises.
 * Resolves to the last task's result.
 */
export declare function pipeline(tasks: Task[], ...args: unknown[]): Promise<any>;

/**
 * Run tasks one after another, each called with the same arguments.
 * Resolves to the results in input order. Tasks may return different types,
 * and every task must accept the given arguments.
 */
export declare function sequence<Args extends unknown[], T extends (...args: Args) => unknown>(
    tasks: readonly T[],
    ...args: Args
): Promise<Array<Awaited<ReturnType<T>>>>;

/**
 * Run tasks with at most `maxConcurrent` running at once.
 * Resolves to the results in input order. Tasks may return different types.
 */
export declare function pool<T extends () => unknown>(
    tasks: readonly T[],
    maxConcurrent: number,
): Promise<Array<Awaited<ReturnType<T>>>>;
