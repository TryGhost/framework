const assert = require('node:assert/strict');
const sinon = require('sinon');
const installPlugin = require('..');

describe('@tryghost/bookshelf-search', function () {
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

    it('provides default searchQuery function', function () {
        const model = new Bookshelf.Model();
        assert.equal(typeof model.searchQuery, 'function');
        assert.equal(model.searchQuery(), undefined);
    });

    it('applySearchQuery calls query and forwards qb/search to searchQuery', function () {
        const model = new Bookshelf.Model();
        const qb = {};

        model.searchQuery = sinon.stub();
        model.query = sinon.stub().callsFake(fn => fn(qb));

        model.applySearchQuery({search: 'news'});

        assert.equal(model.query.calledOnce, true);
        assert.equal(model.searchQuery.calledOnceWithExactly(qb, 'news'), true);
    });

    it('applySearchQuery does nothing when search option is missing', function () {
        const model = new Bookshelf.Model();
        model.query = sinon.stub();

        model.applySearchQuery({});
        assert.equal(model.query.called, false);
    });
});
