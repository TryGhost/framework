const assert = require('assert/strict');

const DatabaseInfo = require('../');

function buildKnex({client, version = '0.0.0', rawResult, rawReject}) {
    return {
        client: {
            config: {client},
            driver: {VERSION: version}
        },
        raw: async () => {
            if (rawReject) {
                throw rawReject;
            }
            return rawResult;
        }
    };
}

describe('DatabaseInfo', function () {
    it('should export a class', function () {
        assert.equal(typeof DatabaseInfo, 'function');
    });

    it('can construct the class', function () {
        const knex = buildKnex({client: 'sqlite3'});
        const databaseInfo = new DatabaseInfo(knex);
        assert.ok(databaseInfo instanceof DatabaseInfo);
    });

    it('init recognises sqlite3 and sets sqlite details', async function () {
        const knex = buildKnex({client: 'sqlite3', version: '3.45.0'});
        const databaseInfo = new DatabaseInfo(knex);
        const details = await databaseInfo.init();

        assert.deepEqual(details, {
            driver: 'sqlite3',
            database: 'SQLite',
            engine: 'sqlite3',
            version: '3.45.0'
        });
        assert.equal(databaseInfo.getDriver(), 'sqlite3');
        assert.equal(databaseInfo.getDatabase(), 'SQLite');
        assert.equal(databaseInfo.getEngine(), 'sqlite3');
        assert.equal(databaseInfo.getVersion(), '3.45.0');
    });

    it('init recognises mysql2 and maps MariaDB version', async function () {
        const knex = buildKnex({
            client: 'mysql2',
            rawResult: [[{version: '10.6.18-MariaDB-1:10.6.18+maria~ubu2204'}]]
        });
        const details = await new DatabaseInfo(knex).init();

        assert.deepEqual(details, {
            driver: 'mysql2',
            database: 'MariaDB',
            engine: 'mariadb',
            version: '10.6.18'
        });
    });

    it('init recognises mysql and maps MySQL 5 engine', async function () {
        const knex = buildKnex({
            client: 'mysql',
            rawResult: [[{version: '5.7.44'}]]
        });
        const details = await new DatabaseInfo(knex).init();

        assert.deepEqual(details, {
            driver: 'mysql',
            database: 'MySQL',
            engine: 'mysql5',
            version: '5.7.44'
        });
    });

    it('init recognises mysql and maps MySQL 8 engine', async function () {
        const knex = buildKnex({
            client: 'mysql',
            rawResult: [[{version: '8.0.39'}]]
        });
        const details = await new DatabaseInfo(knex).init();

        assert.deepEqual(details, {
            driver: 'mysql',
            database: 'MySQL',
            engine: 'mysql8',
            version: '8.0.39'
        });
    });

    it('init recognises mysql and maps unknown major to generic mysql engine', async function () {
        const knex = buildKnex({
            client: 'mysql',
            rawResult: [[{version: '9.1.0'}]]
        });
        const details = await new DatabaseInfo(knex).init();

        assert.deepEqual(details, {
            driver: 'mysql',
            database: 'MySQL',
            engine: 'mysql',
            version: '9.1.0'
        });
    });

    it('init returns unknown details on mysql query failure', async function () {
        const knex = buildKnex({
            client: 'mysql2',
            rawReject: new Error('cannot query version')
        });
        const details = await new DatabaseInfo(knex).init();

        assert.deepEqual(details, {
            driver: 'mysql2',
            database: 'unknown',
            engine: 'unknown',
            version: 'unknown'
        });
    });

    it('init keeps unknown details for unsupported drivers', async function () {
        const knex = buildKnex({client: 'postgres'});
        const details = await new DatabaseInfo(knex).init();

        assert.deepEqual(details, {
            driver: 'postgres',
            database: 'unknown',
            engine: 'unknown',
            version: 'unknown'
        });
    });

    it('recognises sqlite drivers', function () {
        assert.equal(DatabaseInfo.isSQLite(buildKnex({client: 'sqlite3'})), true);
        assert.equal(DatabaseInfo.isSQLite(buildKnex({client: 'better-sqlite3'})), true);
        assert.equal(DatabaseInfo.isSQLite(buildKnex({client: 'mysql'})), false);
    });

    it('recognises mysql drivers', function () {
        assert.equal(DatabaseInfo.isMySQL(buildKnex({client: 'mysql'})), true);
        assert.equal(DatabaseInfo.isMySQL(buildKnex({client: 'mysql2'})), true);
        assert.equal(DatabaseInfo.isMySQL(buildKnex({client: 'sqlite3'})), false);
    });

    it('recognises sqlite config', function () {
        assert.equal(DatabaseInfo.isSQLiteConfig({client: 'sqlite3'}), true);
        assert.equal(DatabaseInfo.isSQLiteConfig({client: 'better-sqlite3'}), true);
        assert.equal(DatabaseInfo.isSQLiteConfig({client: 'mysql'}), false);
    });

    it('recognises mysql config', function () {
        assert.equal(DatabaseInfo.isMySQLConfig({client: 'mysql'}), true);
        assert.equal(DatabaseInfo.isMySQLConfig({client: 'mysql2'}), true);
        assert.equal(DatabaseInfo.isMySQLConfig({client: 'sqlite3'}), false);
    });
});
