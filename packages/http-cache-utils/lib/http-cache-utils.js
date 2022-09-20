/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns Boolean
 */
module.exports.isReqResUserSpecific = (req, res) => {
    return req?.get('cookie')
        || req?.get('authorization')
        || res?.get('set-cookie');
};
