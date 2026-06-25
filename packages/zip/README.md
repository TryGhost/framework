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

### `extract` options

- `limits.perEntryUncompressedBytes` / `limits.totalUncompressedBytes` — reject archives whose entries exceed the given uncompressed sizes.
- `onEntry(entry, zipfile)` — called for every entry before it is written.
- `ensureOwnerPermissions` (default `false`) — when `true`, normalizes extracted entry permissions so the owner can always read, move and remove the result. Directories gain at least owner `rwx` and files gain at least owner `rw`, while existing execute/group/world bits are preserved. The source zip is never modified.

    This fixes archives that contain read-only directories (for example a `dr-xr-xr-x` / `0555` folder), which otherwise fail to extract because nested files cannot be written into them. It is intended for **trusted temporary extraction** of user-supplied archives (such as theme zips) where the caller must be able to read, move and remove the extracted tree.

    ```
    let res = await zip.extract('path/to/upload.zip', 'path/to/tmp', {ensureOwnerPermissions: true})
    ```

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
