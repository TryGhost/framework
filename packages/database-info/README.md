# Database Info

`@tryghost/database-info` is a small utility for `knex` that returns information on the underlying DB connection.

It currently works with SQLite, MySQL 5 & 8, and MariaDB.

## Install

`npm install @tryghost/database-info --save`

or

`pnpm add @tryghost/database-info`

## Purpose

Utility for detecting database driver, engine family, and version from a Knex connection.

## Usage

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
