const { isMainThread, parentPort, workerData } = require('worker_threads');
const util = require('util');
const setTimeoutPromise = util.promisify(setTimeout);

const passTime = async (ms) => {
    const duration = Number.isInteger(ms) ? ms : ms?.ms;

    if (Number.isInteger(duration)) {
        await setTimeoutPromise(duration);
    }
};

if (isMainThread) {
    module.exports = passTime;
} else {
    (async () => {
        await passTime(workerData && Object.hasOwn(workerData, 'ms') ? workerData.ms : workerData);
        parentPort.postMessage('done');
        // alternative way to signal "finished" work (not recommended)
        // process.exit();
    })();
}
