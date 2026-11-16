export import extract = require('./lib/extract');
export import compress = require('./lib/compress');

export type ExtractOptions = extract.ExtractOptions;
export type ExtractLimits = extract.ExtractLimits;
export type ExtractResult = extract.ExtractResult;
export type ZipEntry = extract.ZipEntry;
export type ZipFile = extract.ZipFile;
export type CompressOptions = compress.CompressOptions;
export type CompressResult = compress.CompressResult;
