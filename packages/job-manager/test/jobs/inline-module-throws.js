module.exports = async function runInlineModuleThrowJob() {
    throw new Error('inline module failure');
};
