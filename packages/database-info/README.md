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

Two entry points. Both build nothing when they are imported.

```js
// Stateless functions: nothing is kept between calls
const {
    getDialect,
    isMySQL,
    isSQLite,
    describeDatabase,
} = require('@tryghost/database-info/dialect');

getDialect(knex); // 'mysql' | 'sqlite' | 'unknown'
isSQLite(knex); // also accepts a transaction
await describeDatabase(knex); // {driver, database, engine, version}; one query on MySQL, never rejects

// The original class, which holds what it found for one knex instance
const DatabaseInfo = require('@tryghost/database-info');
const info = new DatabaseInfo(knex);
await info.init();
info.getEngine(); // 'sqlite3' | 'mysql5' | 'mysql8' | 'mysql' | 'mariadb' | 'unknown'
DatabaseInfo.isMySQLConfig({ client: 'mysql2' });
```

The dialect is read from `knex.client.dialect`, which knex sets for every
driver and any Client subclass, so a knex config may name a Client class
rather than a driver string.

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
