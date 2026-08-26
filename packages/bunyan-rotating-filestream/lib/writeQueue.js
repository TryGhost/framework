const { EventEmitter } = require('events');
const { BytesWritten } = require('./customEvents');

class WriteQueue extends EventEmitter {
    constructor() {
        super();
        this._events = [];
        this._fileHandle = null;
        this._paused = true;
        this._isWriting = false;
        this._writing = Promise.resolve(true);
    }

    setFileHandle(fileHandle) {
        this._fileHandle = fileHandle;
        this._paused = false;
    }

    async _write(amount) {
        const data = this._events.splice(0, amount).join('');
        const result = await this._fileHandle.write(data);
        this.emit(BytesWritten, result.bytesWritten);
        this._isWriting = false;
    }

    push(event) {
        this._events.push(event);
        if (!this._paused && !this._isWriting) {
            this.flushToDisk();
        }
    }

    flushToDisk() {
        const currentEventCount = this._events.length;
        this._isWriting = true;
        this._writing = this._write(currentEventCount);
    }

    /**
     * Drain everything queued so far, leaving the queue writable afterwards.
     *
     * Writes are asynchronous, so a process that exits right after logging
     * (e.g. on a fatal boot error) can lose the lines still sitting in the
     * queue. Unlike `shutdown()` this does not pause the queue, so it is safe
     * to call at any point in the process lifetime.
     * @returns {Promise<void>}
     */
    async flush() {
        // The in-flight write owns the events it already spliced off the
        // queue, so wait for it before queueing another write
        await this._writing;

        // A single write only takes the events present when it started, and
        // anything pushed while it ran is not picked up until the next push
        while (!this._paused && this._events.length) {
            this.flushToDisk();
            await this._writing;
        }
    }

    async pause() {
        this._paused = true;
        await this._writing;
    }

    async shutdown() {
        if (!this._paused) {
            this.flushToDisk();
        }
        await this.pause();
    }
}

module.exports = WriteQueue;
