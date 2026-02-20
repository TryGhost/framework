const assert = require('node:assert/strict');
const sinon = require('sinon');
const debugBase = require('@tryghost/debug')._base;
const installPlugin = require('..');

describe('@tryghost/bookshelf-eager-load', function () {
    let Bookshelf;
    let ParentModel;
    let initStub;
    let fetchStub;
    let fetchAllStub;

    beforeEach(function () {
        initStub = sinon.stub().returns('INIT');
        fetchStub = sinon.stub().returns('FETCH');
        fetchAllStub = sinon.stub().returns('FETCH_ALL');

        ParentModel = function BaseModel() {};
        ParentModel.prototype.initialize = initStub;
        ParentModel.prototype.fetch = fetchStub;
        ParentModel.prototype.fetchAll = fetchAllStub;

        ParentModel.extend = function extend(proto) {
            function Child() {}
            Child.prototype = Object.create(ParentModel.prototype);
            Object.assign(Child.prototype, proto);
            Child.prototype.constructor = Child;
            Child.extend = ParentModel.extend;
            return Child;
        };

        Bookshelf = {Model: ParentModel};
        installPlugin(Bookshelf);
    });

    afterEach(function () {
        sinon.restore();
    });

    it('exports plugin from index', function () {
        assert.equal(typeof require('../index'), 'function');
    });

    it('initialize calls parent initialize', function () {
        const model = new Bookshelf.Model();
        const result = model.initialize('a1');
        assert.equal(result, 'INIT');
        assert.equal(initStub.calledOnceWithExactly('a1'), true);
    });

    it('fetch calls parent fetch and skips load when options are missing', function () {
        sinon.stub(debugBase, 'enabled').returns(false);
        const model = new Bookshelf.Model();
        model.query = sinon.stub().returns({toQuery: sinon.stub().returns('SQL')});

        const result = model.fetch();

        assert.equal(result, 'FETCH');
        assert.equal(fetchStub.calledOnce, true);
    });

    it('fetch loads eager join when configured and relation requested', function () {
        sinon.stub(debugBase, 'enabled').returns(false);
        const model = new Bookshelf.Model();
        model.eagerLoad = ['authors'];
        model.relationsMeta = {
            authors: {
                targetTableName: 'users',
                foreignKey: 'post_id'
            },
            tags: {
                targetTableName: 'tags',
                foreignKey: 'post_id'
            }
        };
        model.constructor = {prototype: {tableName: 'posts'}};

        const leftJoin = sinon.stub().returns({
            toSQL() {
                return {sql: 'select *'};
            }
        });
        const qb = {leftJoin};

        model.query = sinon.stub().callsFake((arg) => {
            if (typeof arg === 'function') {
                return arg(qb);
            }
            return {toQuery: sinon.stub().returns('SQL')};
        });

        const result = model.fetch({withRelated: ['authors', 'tags']});

        assert.equal(result, 'FETCH');
        assert.equal(leftJoin.calledOnceWithExactly('users', 'posts.id', 'users.post_id'), true);
        assert.equal(fetchStub.calledOnce, true);
    });

    it('fetch does not load eager join when columns are provided', function () {
        sinon.stub(debugBase, 'enabled').returns(false);
        const model = new Bookshelf.Model();
        model.eagerLoad = ['authors'];
        model.relationsMeta = {
            authors: {
                targetTableName: 'users',
                foreignKey: 'post_id'
            }
        };
        model.constructor = {prototype: {tableName: 'posts'}};

        const leftJoin = sinon.stub().returns({
            toSQL() {
                return {sql: 'select *'};
            }
        });
        const qb = {leftJoin};

        model.query = sinon.stub().callsFake((arg) => {
            if (typeof arg === 'function') {
                return arg(qb);
            }
            return {toQuery: sinon.stub().returns('SQL')};
        });

        model.fetch({columns: ['id'], withRelated: ['authors']});

        assert.equal(leftJoin.called, false);
    });

    it('fetch does not load eager join when withRelated does not intersect eagerLoad', function () {
        sinon.stub(debugBase, 'enabled').returns(false);
        const model = new Bookshelf.Model();
        model.eagerLoad = ['authors'];
        model.relationsMeta = {
            authors: {
                targetTableName: 'users',
                foreignKey: 'post_id'
            }
        };
        model.constructor = {prototype: {tableName: 'posts'}};

        const leftJoin = sinon.stub().returns({
            toSQL() {
                return {sql: 'select *'};
            }
        });
        const qb = {leftJoin};

        model.query = sinon.stub().callsFake((arg) => {
            if (typeof arg === 'function') {
                return arg(qb);
            }
            return {toQuery: sinon.stub().returns('SQL')};
        });

        model.fetch({withRelated: ['tags']});

        assert.equal(leftJoin.called, false);
    });

    it('fetch skips eager query when relationsMeta is missing', function () {
        sinon.stub(debugBase, 'enabled').returns(false);
        const model = new Bookshelf.Model();
        model.eagerLoad = ['authors'];
        model.constructor = {prototype: {tableName: 'posts'}};

        model.query = sinon.stub().callsFake((arg) => {
            if (typeof arg === 'function') {
                return arg({});
            }
            return {toQuery: sinon.stub().returns('SQL')};
        });

        model.fetch({withRelated: ['authors']});

        assert.equal(fetchStub.calledOnce, true);
    });

    it('fetch logs query when debug is enabled', function () {
        sinon.stub(debugBase, 'enabled').returns(true);
        const model = new Bookshelf.Model();
        model.query = sinon.stub().callsFake(() => {
            return {toQuery: sinon.stub().returns('SELECT 1')};
        });

        const result = model.fetch({});

        assert.equal(result, 'FETCH');
        assert.equal(fetchStub.calledOnce, true);
    });

    it('fetchAll logs query when debug is enabled and calls parent fetchAll', function () {
        sinon.stub(debugBase, 'enabled').returns(true);
        const model = new Bookshelf.Model();
        model.query = sinon.stub().callsFake(() => {
            return {toQuery: sinon.stub().returns('SELECT 1')};
        });

        const result = model.fetchAll({});

        assert.equal(result, 'FETCH_ALL');
        assert.equal(fetchAllStub.calledOnce, true);
    });
});
