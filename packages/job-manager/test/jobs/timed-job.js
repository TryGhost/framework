const util = require('util');
const setTimeoutPromise = util.promisify(setTimeout);

const passTime = async (data) => {
    const ms = typeof data === 'object' ? data.ms : data;

    if (Number.isInteger(ms)) {
        await setTimeoutPromise(ms);
    } else {
        await setTimeoutPromise(ms.ms);
    }
};

module.exports = passTime;
