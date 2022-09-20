module.exports.isReqResUserSpecific = (req, res) => {
    return req?.get('cookie')
        || req?.get('authorization')
        || res?.get('set-cookie');
};
