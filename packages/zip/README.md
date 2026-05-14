# Zip

## Install

`npm install @tryghost/zip --save`

or

`pnpm add @tryghost/zip`

## Purpose

Zip compression and extraction utilities with safety checks for symlinks and unsafe filenames.

## Usage

```
const zip = require('@tryghost/zip');

// Create a zip from a folder

let res = await zip.compress('path/to/a/folder', 'path/to/archive.zip', [options])

// Extract a zip to a folder

let res = await zip.extract('path/to/archive.zip', 'path/to/files', [options])
```

`extract` accepts optional uncompressed size limits:

```js
await zip.extract('path/to/archive.zip', 'path/to/files', {
    limits: {
        perEntryUncompressedBytes: 536870912,
        totalUncompressedBytes: 4294967296,
    },
});
```

Limits default to `Infinity` to preserve existing behaviour when omitted. They are enforced against _actual_ decompressed bytes during streaming, not just the declared central-directory metadata — so a zip whose header lies about its uncompressed size is still caught.

## Develop

This is a mono repository, managed with [Nx](https://nx.dev).

Follow the instructions for the top-level repo.

1. `git clone` this repo & `cd` into it as usual
2. Run `pnpm install` to install top-level dependencies.

## Run

- `pnpm dev`

## Test

- `pnpm lint` runs oxlint
- `pnpm test` runs lint and tests

# Copyright & License

Copyright (c) 2013-2026 Ghost Foundation - Released under the [MIT license](LICENSE).
