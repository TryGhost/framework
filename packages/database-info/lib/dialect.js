/**
 * Stateless helpers for telling which database a knex instance talks to.
 *
 * Nothing here holds state, reads config, the environment or a file, or does
 * anything when it is imported. Each function works from what it is handed, so
 * an application can call them from code that must not hold state of its own.
 */

const SQLITE_DRIVERS = ['sqlite3', 'better-sqlite3'];
const MYSQL_DRIVERS = ['mysql', 'mysql2'];

/**
 * The dialect a knex config names.
 *
 * `client` may be a driver name (`'mysql2'`), or a knex Client class, in which
 * case its `dialect` is read from the prototype as knex itself does.
 *
 * @param {{client?: unknown}} config
 * @returns {'mysql' | 'sqlite' | 'unknown'}
 */
function getConfigDialect(config) {
    const client = config && config.client;

    if (typeof client === 'function') {
        return fromKnexDialect(client.prototype && client.prototype.dialect);
    }

    if (SQLITE_DRIVERS.includes(client)) {
        return 'sqlite';
    }

    if (MYSQL_DRIVERS.includes(client)) {
        return 'mysql';
    }

    return 'unknown';
}

/**
 * The dialect a knex instance or transaction talks to.
 *
 * Knex sets `client.dialect` to `'sqlite3'` for both SQLite drivers and to
 * `'mysql'` for both MySQL drivers, including any subclass of them. Older
 * callers and test doubles may only carry `client.config.client`, which is
 * read when `dialect` is missing.
 *
 * @param {{client: {dialect?: string, config?: {client?: unknown}}}} knex
 * @returns {'mysql' | 'sqlite' | 'unknown'}
 */
function getDialect(knex) {
    const client = knex && knex.client;

    if (!client) {
        return 'unknown';
    }

    const fromDialect = fromKnexDialect(client.dialect);
    if (fromDialect !== 'unknown') {
        return fromDialect;
    }

    return getConfigDialect(client.config || {});
}

/**
 * @param {unknown} dialect
 * @returns {'mysql' | 'sqlite' | 'unknown'}
 */
function fromKnexDialect(dialect) {
    if (dialect === 'sqlite3' || dialect === 'better-sqlite3') {
        return 'sqlite';
    }

    if (dialect === 'mysql' || dialect === 'mysql2') {
        return 'mysql';
    }

    return 'unknown';
}

/** @param {Parameters<typeof getDialect>[0]} knex */
const isSQLite = (knex) => getDialect(knex) === 'sqlite';

/** @param {Parameters<typeof getDialect>[0]} knex */
const isMySQL = (knex) => getDialect(knex) === 'mysql';

/** @param {Parameters<typeof getConfigDialect>[0]} config */
const isSQLiteConfig = (config) => getConfigDialect(config) === 'sqlite';

/** @param {Parameters<typeof getConfigDialect>[0]} config */
const isMySQLConfig = (config) => getConfigDialect(config) === 'mysql';

/**
 * Asks the database what it is. Runs one query on MySQL and none on SQLite, and
 * keeps nothing: a caller that wants the answer more than once holds it.
 *
 * Never rejects. If the database cannot be asked, the details it could not
 * work out are `'unknown'`.
 *
 * @param {{client: {dialect?: string, driverName?: string, config?: {client?: unknown}, driver?: {VERSION?: string}}, raw(sql: string): PromiseLike<any>}} knex
 * @returns {Promise<{driver: string, database: string, engine: string, version: string}>}
 */
async function describeDatabase(knex) {
    const client = knex.client;
    const configClient = client.config && client.config.client;
    const driver = typeof configClient === 'string' ? configClient : client.driverName || 'unknown';

    const details = {
        driver,
        database: 'unknown',
        engine: 'unknown',
        version: 'unknown',
    };

    switch (getDialect(knex)) {
        case 'sqlite':
            details.database = 'SQLite';
            details.engine = 'sqlite3';
            details.version = client.driver.VERSION;
            break;
        case 'mysql':
            try {
                const result = await knex.raw('SELECT version() as version;');
                const version = result[0][0].version;

                if (version.includes('MariaDB')) {
                    details.database = 'MariaDB';
                    details.engine = 'mariadb';
                    details.version = version.split('-')[0];
                } else {
                    details.database = 'MySQL';

                    if (version.startsWith('5')) {
                        details.engine = 'mysql5';
                    } else if (version.startsWith('8')) {
                        details.engine = 'mysql8';
                    } else {
                        details.engine = 'mysql';
                    }

                    details.version = version;
                }
            } catch {
                // Leave the details it could not work out as 'unknown'
            }
            break;
        default:
            // An unsupported driver keeps the 'unknown' details
            break;
    }

    return details;
}

module.exports = {
    getDialect,
    getConfigDialect,
    isSQLite,
    isMySQL,
    isSQLiteConfig,
    isMySQLConfig,
    describeDatabase,
};
