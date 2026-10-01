const path = require('path');
const JobManager = require('../../lib/JobManager');

const jobManager = new JobManager(console);

const isJobQueueEmpty = (bree) => {
    return (
        Object.keys(bree.workers).length === 0 &&
        Object.keys(bree.intervals).length === 0 &&
        Object.keys(bree.timeouts).length === 0
    );
};

(async () => {
    const dateInTenSeconds = new Date(Date.now() + 10 * 1000);

    jobManager.addJob({
        at: dateInTenSeconds,
        job: path.resolve(__dirname, '../jobs/timed-job.js'),
        data: {
            ms: 2000,
        },
        name: 'one-off-scheduled-job',
    });

    const { default: pWaitFor } = await import('p-wait-for');
    await pWaitFor(() => isJobQueueEmpty(jobManager.bree));

    process.exit(0);
})();
