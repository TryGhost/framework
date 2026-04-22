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
