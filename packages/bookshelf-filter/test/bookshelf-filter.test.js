const assert = require('node:assert/strict');
const Module = require('node:module');
const sinon = require('sinon');
const errors = require('@tryghost/errors');
const installPlugin = require('..');

describe('@tryghost/bookshelf-filter', function () {
    let Bookshelf;
    let ParentModel;

    beforeEach(function () {
        ParentModel = function BaseModel() {};
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

    it('replaces Bookshelf.Model with extended model', function () {
        assert.notEqual(Bookshelf.Model, ParentModel);
    });

    it('provides default no-op filter methods', function () {
        const model = new Bookshelf.Model();
        assert.equal(model.enforcedFilters(), undefined);
        assert.equal(model.defaultFilters(), undefined);
        assert.equal(model.extraFilters(), undefined);
        assert.equal(model.filterExpansions(), undefined);
        assert.equal(model.filterRelations(), undefined);
        assert.equal(model._filters, null);
    });

    it('applies composed filters and forwards nql options', function () {
        const qb = {where: sinon.stub()};
        const querySQL = sinon.stub();
        const nqlStub = sinon.stub().returns({querySQL});
        sinon.stub(Module, '_load').callsFake((request, parent, isMain) => {
            if (request === '@tryghost/nql') {
                return nqlStub;
            }
            return Module._load.wrappedMethod.call(Module, request, parent, isMain);
        });

        const model = new Bookshelf.Model();
        model.filterExpansions = sinon.stub().returns(['posts.tags']);
        model.extraFilters = sinon.stub().returns('status:published');
        model.enforcedFilters = sinon.stub().returns('visibility:public');
        model.defaultFilters = sinon.stub().returns('type:post');
        model.filterRelations = sinon.stub().returns({authors: {tableName: 'users'}});
        model.query = sinon.stub().callsFake(fn => fn(qb));

        const options = {
            filter: 'title:test',
            useCTE: true,
            mongoTransformer: sinon.stub()
        };

        model.applyDefaultAndCustomFilters(options);

        assert.equal(model.query.calledOnce, true);
        assert.equal(nqlStub.calledOnce, true);
        assert.equal(nqlStub.firstCall.args[0], 'title:test+status:published');
        assert.deepEqual(nqlStub.firstCall.args[1], {
            relations: {authors: {tableName: 'users'}},
            expansions: ['posts.tags'],
            overrides: 'visibility:public',
            defaults: 'type:post',
            transformer: options.mongoTransformer,
            cte: true
        });
        assert.equal(querySQL.calledOnceWithExactly(qb), true);
    });

    it('uses extra filter as custom filter when custom is missing', function () {
        const qb = {};
        const querySQL = sinon.stub();
        const nqlStub = sinon.stub().returns({querySQL});
        sinon.stub(Module, '_load').callsFake((request, parent, isMain) => {
            if (request === '@tryghost/nql') {
                return nqlStub;
            }
            return Module._load.wrappedMethod.call(Module, request, parent, isMain);
        });

        const model = new Bookshelf.Model();
        model.filterExpansions = sinon.stub().returns(undefined);
        model.extraFilters = sinon.stub().returns('status:published');
        model.enforcedFilters = sinon.stub().returns(undefined);
        model.defaultFilters = sinon.stub().returns(undefined);
        model.filterRelations = sinon.stub().returns(undefined);
        model.query = sinon.stub().callsFake(fn => fn(qb));

        model.applyDefaultAndCustomFilters({
            useCTE: false
        });

        assert.equal(nqlStub.firstCall.args[0], 'status:published');
        assert.deepEqual(nqlStub.firstCall.args[1], {
            relations: {},
            expansions: [],
            overrides: undefined,
            defaults: undefined,
            transformer: undefined,
            cte: false
        });
    });

    it('wraps parser errors in BadRequestError', function () {
        const rootError = new Error('parse failed');
        const nqlStub = sinon.stub().throws(rootError);
        sinon.stub(Module, '_load').callsFake((request, parent, isMain) => {
            if (request === '@tryghost/nql') {
                return nqlStub;
            }
            return Module._load.wrappedMethod.call(Module, request, parent, isMain);
        });

        const model = new Bookshelf.Model();
        model.query = sinon.stub().callsFake(fn => fn({}));

        assert.throws(() => {
            model.applyDefaultAndCustomFilters({filter: 'bad'});
        }, (err) => {
            assert.equal(err instanceof errors.BadRequestError, true);
            assert.equal(err.message, 'Error parsing filter');
            return true;
        });
    });
});
