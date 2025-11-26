/* eslint-disable no-console */

const setTimeoutPromise = require('util').promisify(setTimeout);

module.exports = async () => {
    console.log('started graceful job');

    await setTimeoutPromise(100);
    console.log('worked for 100 ms');

    console.log('exiting gracefully');
};
