const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const FormData = require('form-data');

module.exports.isJSON = function isJSON(mimeType) {
    // should match /json or +json
    // but not /json-seq
    return /[/+]json($|[^-\w])/i.test(mimeType);
};

module.exports.normalizeURL = function normalizeURL(toNormalize) {
    const split = toNormalize.split('?');
    const pathname = split[0];
    let normalized = pathname + (pathname.endsWith('/') ? '' : '/');

    if (split.length === 2) {
        normalized += `?${split[1]}`;
    }

    return normalized;
};

module.exports.attachFile = function attachFile(name, filePath) {
    const formData = new FormData();
    const fileContent = fs.readFileSync(filePath);
    const filename = path.basename(filePath);
    const contentType = mime.lookup(filePath) || 'application/octet-stream';

    formData.append(name, fileContent, {
        filename,
        contentType
    });

    return formData;
};
