type SequenceTask = (...args: unknown[]) => Promise<unknown> | unknown;

async function sequence(tasks: SequenceTask[], ...args: unknown[]): Promise<unknown[]> {
    const results: unknown[] = [];
    for (const task of tasks) {
        results.push(await task.apply(null, args));
    }
    return results;
}

export default sequence;
