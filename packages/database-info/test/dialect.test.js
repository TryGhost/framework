const assert = require('assert/strict');

const dialect = require('../dialect');

function buildKnex({
    dialect: knexDialect,
    client,
    driverName,
    version = '0.0.0',
    rawResult,
    rawReject,
}) {
    return {
        client: {
            dialect: knexDialect,
            driverName,
            config: { client },
            driver: { VERSION: version },
        },
        raw: async () => {
            if (rawReject) {
                throw rawReject;
            }
            return rawResult;
        },
    };
}

describe('dialect', function () {
    describe('getDialect', function () {
        it('reads the dialect knex sets on its client', function () {
            // knex sets `dialect: 'sqlite3'` for better-sqlite3 and `dialect: 'mysql'` for mysql2
            assert.equal(
                dialect.getDialect(buildKnex({ dialect: 'sqlite3', client: 'better-sqlite3' })),
                'sqlite',
            );
            assert.equal(
                dialect.getDialect(buildKnex({ dialect: 'mysql', client: 'mysql2' })),
                'mysql',
            );
        });

        it('reads the dialect when the config names a Client class rather than a driver', function () {
            class CustomSqlite {}
            assert.equal(
                dialect.getDialect(buildKnex({ dialect: 'sqlite3', client: CustomSqlite })),
                'sqlite',
            );
        });

        it('falls back to the configured client when knex sets no dialect', function () {
            assert.equal(dialect.getDialect(buildKnex({ client: 'sqlite3' })), 'sqlite');
            assert.equal(dialect.getDialect(buildKnex({ client: 'mysql' })), 'mysql');
            assert.equal(dialect.getDialect(buildKnex({ client: 'pg' })), 'unknown');
        });

        it('is unknown for something that is not a knex instance', function () {
            assert.equal(dialect.getDialect({}), 'unknown');
            assert.equal(dialect.getDialect(undefined), 'unknown');
            assert.equal(dialect.getDialect({ client: { dialect: 'postgresql' } }), 'unknown');
        });
    });

    describe('getConfigDialect', function () {
        it('reads driver names', function () {
            assert.equal(dialect.getConfigDialect({ client: 'better-sqlite3' }), 'sqlite');
            assert.equal(dialect.getConfigDialect({ client: 'mysql2' }), 'mysql');
            assert.equal(dialect.getConfigDialect({ client: 'pg' }), 'unknown');
            assert.equal(dialect.getConfigDialect({}), 'unknown');
            assert.equal(dialect.getConfigDialect(undefined), 'unknown');
        });

        it('reads the dialect of a Client class', function () {
            class Mysql {}
            Mysql.prototype.dialect = 'mysql';
            assert.equal(dialect.getConfigDialect({ client: Mysql }), 'mysql');
            assert.equal(dialect.getConfigDialect({ client: class {} }), 'unknown');
        });
    });

    it('has boolean checks for instances and configs', function () {
        assert.equal(dialect.isSQLite(buildKnex({ dialect: 'sqlite3' })), true);
        assert.equal(dialect.isMySQL(buildKnex({ dialect: 'sqlite3' })), false);
        assert.equal(dialect.isMySQL(buildKnex({ dialect: 'mysql' })), true);
        assert.equal(dialect.isSQLiteConfig({ client: 'sqlite3' }), true);
        assert.equal(dialect.isMySQLConfig({ client: 'mysql2' }), true);
        assert.equal(dialect.isMySQLConfig({ client: 'sqlite3' }), false);
    });

    describe('describeDatabase', function () {
        it('describes SQLite without a query', async function () {
            const knex = buildKnex({
                dialect: 'sqlite3',
                client: 'better-sqlite3',
                version: '12.11.1',
                rawReject: new Error('no query expected'),
            });
            assert.deepEqual(await dialect.describeDatabase(knex), {
                driver: 'better-sqlite3',
                database: 'SQLite',
                engine: 'sqlite3',
                version: '12.11.1',
            });
        });

        it('names the driver from knex when the config names a Client class', async function () {
            const knex = buildKnex({
                dialect: 'sqlite3',
                client: class {},
                driverName: 'better-sqlite3',
                version: '12.11.1',
            });
            assert.equal((await dialect.describeDatabase(knex)).driver, 'better-sqlite3');

            const unnamed = buildKnex({ dialect: 'sqlite3', client: class {}, version: '12.11.1' });
            assert.equal((await dialect.describeDatabase(unnamed)).driver, 'unknown');
        });

        it('describes MySQL 8 and MariaDB from one query', async function () {
            const mysql = buildKnex({
                dialect: 'mysql',
                client: 'mysql2',
                rawResult: [[{ version: '8.4.5' }]],
            });
            assert.deepEqual(await dialect.describeDatabase(mysql), {
                driver: 'mysql2',
                database: 'MySQL',
                engine: 'mysql8',
                version: '8.4.5',
            });

            const maria = buildKnex({
                dialect: 'mysql',
                client: 'mysql2',
                rawResult: [[{ version: '10.11.6-MariaDB-1' }]],
            });
            assert.deepEqual(await dialect.describeDatabase(maria), {
                driver: 'mysql2',
                database: 'MariaDB',
                engine: 'mariadb',
                version: '10.11.6',
            });
        });

        it('keeps nothing between calls', async function () {
            let version = '5.7.44';
            const knex = buildKnex({ dialect: 'mysql', client: 'mysql2' });
            knex.raw = async () => [[{ version }]];

            assert.equal((await dialect.describeDatabase(knex)).engine, 'mysql5');
            version = '9.1.0';
            assert.equal((await dialect.describeDatabase(knex)).engine, 'mysql');
        });

        it('never rejects', async function () {
            const knex = buildKnex({
                dialect: 'mysql',
                client: 'mysql2',
                rawReject: new Error('ECONNREFUSED'),
            });
            assert.deepEqual(await dialect.describeDatabase(knex), {
                driver: 'mysql2',
                database: 'unknown',
                engine: 'unknown',
                version: 'unknown',
            });
        });
    });
});
