const assert = require('node:assert/strict');
const sinon = require('sinon');
const debugBase = require('@tryghost/debug')._base;
const plugin = require('..');

describe('@tryghost/bookshelf-has-posts', function () {
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
        plugin(Bookshelf);
    });

    afterEach(function () {
        sinon.restore();
    });

    it('exports plugin and helper', function () {
        assert.equal(typeof require('../index'), 'function');
        assert.equal(typeof plugin.addHasPostsWhere, 'function');
    });

    it('initialize delegates to parent initialize', function () {
        const model = new Bookshelf.Model();
        const result = model.initialize('arg');
        assert.equal(result, 'INIT');
        assert.equal(initStub.calledOnceWithExactly('arg'), true);
    });

    it('addHasPostsWhere builds expected query shape', function () {
        const whereIn = sinon.stub();
        const qb = {whereIn};
        const tableName = 'tags';
        const config = {
            joinTable: 'posts_tags',
            joinTo: 'tag_id'
        };

        const whereFn = plugin.addHasPostsWhere(tableName, config);
        whereFn(qb);

        assert.equal(whereIn.calledOnce, true);
        assert.equal(whereIn.firstCall.args[0], 'tags.id');

        const subqueryBuilder = {
            distinct: sinon.stub().returnsThis(),
            select: sinon.stub().returnsThis(),
            from: sinon.stub().returnsThis(),
            whereRaw: sinon.stub().returnsThis(),
            join: sinon.stub().returnsThis(),
            andWhere: sinon.stub().returnsThis(),
            toSQL: sinon.stub().returns({sql: 'select *'})
        };

        const callbackResult = whereIn.firstCall.args[1].call(subqueryBuilder);
        assert.equal(callbackResult, subqueryBuilder);
        assert.equal(subqueryBuilder.distinct.calledOnceWithExactly('posts_tags.tag_id'), true);
        assert.equal(subqueryBuilder.from.calledOnceWithExactly('posts_tags'), true);
        assert.equal(subqueryBuilder.whereRaw.calledOnceWithExactly('posts_tags.tag_id = tags.id'), true);
        assert.equal(subqueryBuilder.join.calledOnceWithExactly('posts', 'posts.id', 'posts_tags.post_id'), true);
        assert.equal(subqueryBuilder.andWhere.calledOnceWithExactly('posts.status', '=', 'published'), true);
    });

    it('fetch applies has-posts query when configured', function () {
        sinon.stub(debugBase, 'enabled').returns(false);
        const model = new Bookshelf.Model();
        model.tableName = 'tags';
        model.shouldHavePosts = {joinTable: 'posts_tags', joinTo: 'tag_id'};
        model.query = sinon.stub().returns({toQuery: sinon.stub().returns('SQL')});

        const result = model.fetch({});
        assert.equal(result, 'FETCH');
        assert.equal(model.query.calledOnce, true);
        assert.equal(fetchStub.calledOnce, true);
    });

    it('fetch skips has-posts query when not configured', function () {
        sinon.stub(debugBase, 'enabled').returns(false);
        const model = new Bookshelf.Model();
        model.query = sinon.stub().returns({toQuery: sinon.stub().returns('SQL')});

        model.fetch({});
        assert.equal(model.query.called, false);
        assert.equal(fetchStub.calledOnce, true);
    });

    it('fetch logs query when debug is enabled', function () {
        sinon.stub(debugBase, 'enabled').returns(true);
        const model = new Bookshelf.Model();
        model.query = sinon.stub().returns({toQuery: sinon.stub().returns('SELECT 1')});

        const result = model.fetch({});
        assert.equal(result, 'FETCH');
        assert.equal(model.query.calledOnce, true);
    });

    it('fetchAll applies has-posts query and logs in debug mode', function () {
        sinon.stub(debugBase, 'enabled').returns(true);
        const model = new Bookshelf.Model();
        model.tableName = 'authors';
        model.shouldHavePosts = {joinTable: 'posts_authors', joinTo: 'author_id'};
        model.query = sinon.stub().returns({toQuery: sinon.stub().returns('SELECT 2')});

        const result = model.fetchAll({});
        assert.equal(result, 'FETCH_ALL');
        assert.equal(model.query.calledTwice, true);
        assert.equal(fetchAllStub.calledOnce, true);
    });

    it('fetchAll skips query decoration when shouldHavePosts is missing', function () {
        sinon.stub(debugBase, 'enabled').returns(false);
        const model = new Bookshelf.Model();
        model.query = sinon.stub().returns({toQuery: sinon.stub().returns('SELECT 3')});

        model.fetchAll({});
        assert.equal(model.query.called, false);
        assert.equal(fetchAllStub.calledOnce, true);
    });
});
