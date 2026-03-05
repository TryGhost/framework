type PipelineTask = (...args: unknown[]) => Promise<unknown> | unknown;

async function pipeline(tasks: PipelineTask[], ...args: unknown[]): Promise<unknown> {
    let results: unknown = await Promise.all(args);
    for (const task of tasks) {
        results = await task.apply(null, Array.isArray(results) ? results : [results]);
    }
    return results;
}

export default pipeline;
