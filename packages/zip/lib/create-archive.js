module.exports = function createArchive(type) {
    const archiver = require('archiver');
    const archives = {
        json: archiver.JsonArchive,
        tar: archiver.TarArchive,
        zip: archiver.ZipArchive,
    };
    const Archive = archives[type];

    if (!Archive) {
        throw new Error(`Unsupported archive type: ${type}`);
    }

    return new Archive();
};
