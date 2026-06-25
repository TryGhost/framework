// POSIX `stat` mode constants, matching the ones extract-zip uses internally
// when it derives an entry's type and permissions from its external attributes.
const S_IFMT = 0o170000; // bit mask for the file type bit fields
const S_IFDIR = 0o040000; // directory
const S_IFLNK = 0o120000; // symbolic link

// Reads the POSIX mode an entry carries in the high 16 bits of its external
// file attributes, exactly as extract-zip does when extracting.
function getEntryMode(entry) {
    return (entry.externalFileAttributes >> 16) & 0xffff;
}

module.exports = {
    S_IFMT,
    S_IFDIR,
    S_IFLNK,
    getEntryMode,
};
