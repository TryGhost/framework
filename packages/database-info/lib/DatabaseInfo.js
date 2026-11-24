const dialect = require('./dialect');

/**
 * Holds what `describeDatabase()` found for one knex instance.
 *
 * Kept for existing callers. New code that must not hold state can use the
 * functions in `@tryghost/database-info/dialect` directly.
 */
module.exports = class DatabaseInfo {
    /**
     * @param {import('knex').Knex} knex
     */
    constructor(knex) {
        this._knex = knex;
        this._client = this._knex.client;
        this._driver = this._client.config.client;

        this._databaseDetails = {
            // The underlying driver that `knex` uses
            // ie. `sqlite3`, `mysql` or `mysql2`
            driver: this._driver,

            // A capitalized version of the specific database used
            database: 'unknown',

            // A slugified version of the `database`
            engine: 'unknown',

            // The version of the database used
            version: 'unknown',
        };
    }

    async init() {
        const details = await dialect.describeDatabase(this._knex);
        this._databaseDetails = { ...details, driver: this._driver };
        return this._databaseDetails;
    }

    getDriver() {
        return this._databaseDetails.driver;
    }

    getDatabase() {
        return this._databaseDetails.database;
    }

    getEngine() {
        return this._databaseDetails.engine;
    }

    getVersion() {
        return this._databaseDetails.version;
    }

    /**
     * Returns if the driver used is for SQLite
     *
     * @param {import('knex').Knex} knex
     */
    static isSQLite(knex) {
        return dialect.isSQLite(knex);
    }

    /**
     * Returns if the config is for SQLite
     *
     * @param {object} config
     */
    static isSQLiteConfig(config) {
        return dialect.isSQLiteConfig(config);
    }

    /**
     * Returns if the driver used is for MySQL
     *
     * @param {import('knex').Knex} knex
     */
    static isMySQL(knex) {
        return dialect.isMySQL(knex);
    }

    /**
     * Returns if the config is for MySQL
     *
     * @param {object} config
     */
    static isMySQLConfig(config) {
        return dialect.isMySQLConfig(config);
    }
};
