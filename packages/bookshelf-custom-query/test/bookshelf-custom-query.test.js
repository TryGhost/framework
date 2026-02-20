const assert = require('node:assert/strict');
const sinon = require('sinon');
const installPlugin = require('..');

describe('@tryghost/bookshelf-custom-query', function () {
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

    it('provides a default customQuery function', function () {
        const model = new Bookshelf.Model();
        assert.equal(typeof model.customQuery, 'function');
        assert.equal(model.customQuery(), undefined);
    });

    it('applyCustomQuery calls query and forwards qb/options to customQuery', function () {
        const model = new Bookshelf.Model();
        const qb = {where: sinon.stub()};
        const options = {filter: 'status:published'};

        model.customQuery = sinon.stub();
        model.query = sinon.stub().callsFake(fn => fn(qb));

        model.applyCustomQuery(options);

        assert.equal(model.query.calledOnce, true);
        assert.equal(model.customQuery.calledOnceWithExactly(qb, options), true);
    });
});
