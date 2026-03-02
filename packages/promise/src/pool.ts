type Task<T> = () => Promise<T> | T;

async function pool<T>(tasks: Task<T>[], maxConcurrent: number): Promise<T[]> {
    if (maxConcurrent < 1) {
        throw new Error('Must set at least 1 concurrent workers');
    }

    const taskIterator = tasks.entries();
    const results: T[] = [];

    const workers = Array(maxConcurrent).fill(taskIterator).map(
        async (workerIterator: IterableIterator<[number, Task<T>]>) => {
            for (const [index, task] of workerIterator) {
                results[index] = await task();
            }
        }
    );
    await Promise.all(workers);
    return results;
}

export default pool;
