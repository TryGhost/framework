/**
* Custom Should Assertions
*
* Add any custom assertions to this file.
*/

import _ from 'lodash';
import should from 'should';

const errorProps = ['id', 'title', 'detail', 'status', 'code', 'meta'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(should as any).Assertion.add('JSONErrorObject', function (this: any) {
    this.params = {operator: 'to be a valid JSON Error Object'};
    this.obj.should.be.an.Object;
    this.obj.should.have.properties(errorProps);
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(should as any).Assertion.add('JSONErrorResponse', function (this: any, match: unknown) {
    this.params = {operator: 'to be a valid JSON Error Response'};

    this.obj.should.have.property('errors').which.is.an.Array;
    this.obj.errors.length.should.be.above(0);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.obj.errors.forEach(function (err: any) {
        err.should.be.a.JSONErrorObject();
    });

    if (match) {
        _.some(this.obj.errors, match).should.be.true();
    }
});
