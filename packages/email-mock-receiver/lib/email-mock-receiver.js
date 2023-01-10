class EmailMockReceiver {
    #snapshotManager;

    constructor({snapshotManager}) {
        this.#snapshotManager = snapshotManager;
    }
}

module.exports = EmailMockReceiver;