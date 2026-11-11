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

### `compress` options

`compress` zips every file in the folder, including dotfiles, empty directories and symlinks (stored as symlink entries). If the folder itself is a symlink, its target is zipped. Note that `extract` rejects zips containing symlink entries (`SYMLINK_NOT_ALLOWED`), so a folder with symlinks inside cannot be round-tripped through `compress` and `extract`. It resolves to `{path, size}`, where `size` is the size of the written zip in bytes. If `destination` is inside the folder, it is never added to the zip. On failure the partly written zip is removed. Modification times before 1980 are stored as 1980-01-01, the earliest date the zip format supports.

- `ignore` (default `['node_modules']`) — relative path prefixes, using `/` separators, to leave out. A prefix matches that exact path and everything below it, so `'node_modules'` skips the top-level `node_modules` folder only. A trailing `/` or `/**` is accepted and ignored.

    ```
    let res = await zip.compress('path/to/theme', 'path/to/theme.zip', {ignore: ['node_modules', '.git']})
    ```

#### Breaking changes in 5.0.0

`compress` now writes zips with [yazl](https://github.com/thejoshwolfe/yazl) instead of archiver.

- The `type` option has been removed; `compress` only produces zip files (tar and json output are no longer supported).
- The `glob` and `dot` options have been removed; all files are included and dotfiles are always included.
- `ignore` takes relative path prefixes instead of glob patterns. The old default `['node_modules/**']` still works because a trailing `/**` is stripped, but other glob syntax (`*`, `?`, `{a,b}`) is not supported.

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
