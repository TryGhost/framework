const assert = require('assert/strict');
const path = require('path');
const sinon = require('sinon');
const delay = require('delay');
const FakeTimers = require('@sinonjs/fake-timers');
const logging = require('@tryghost/logging');

const JobManager = require('../index');
const assembleBreeJob = require('../lib/assemble-bree-job');
const JobsRepository = require('../lib/JobsRepository');

const sandbox = sinon.createSandbox();

const jobModelInstance = {
    id: 'unique',
    get: (field) => {
        if (field === 'status') {
            return 'finished';
        }
    }
};

describe('Job Manager', function () {
    let stubConfig, jobManager;

    beforeEach(function () {
        sandbox.stub(logging, 'info');
        sandbox.stub(logging, 'warn');
        sandbox.stub(logging, 'error');

        stubConfig = {
            get: sinon.stub().returns({
                enabled: true
            })
        };

        jobManager = new JobManager({
            config: stubConfig
        });
    });

    afterEach(function () {
        sandbox.restore();
    });

    it('public interface', function () {
        assert.notEqual(jobManager.addJob, undefined);
        assert.notEqual(jobManager.hasExecutedSuccessfully, undefined);
        assert.notEqual(jobManager.awaitOneOffCompletion, undefined);
        assert.notEqual(jobManager.awaitCompletion, undefined);
        assert.notEqual(jobManager.allSettled, undefined);
        assert.notEqual(jobManager.removeJob, undefined);
        assert.notEqual(jobManager.shutdown, undefined);
        assert.notEqual(jobManager.inlineJobHandler, undefined);
    });

    describe('Add a job', function () {
        describe('Inline jobs', function () {
            it('adds a job to a queue', async function () {
                const spy = sinon.spy();
                jobManager.addJob({
                    job: spy,
                    data: 'test data',
                    offloaded: false
                });
                assert.equal(jobManager.inlineQueue.idle(), false);

                // give time to execute the job
                await delay(1);

                assert.equal(jobManager.inlineQueue.idle(), true);
                assert.equal(spy.called, true);
                assert.equal(spy.args[0][0], 'test data');
            });

            it('handles failed job gracefully', async function () {
                const spy = sinon.stub().throws();
                const jobModelSpy = {
                    findOne: sinon.spy()
                };

                jobManager.addJob({
                    job: spy,
                    data: 'test data',
                    offloaded: false
                });
                assert.equal(jobManager.inlineQueue.idle(), false);

                // give time to execute the job
                await delay(1);

                assert.equal(jobManager.inlineQueue.idle(), true);
                assert.equal(spy.called, true);
                assert.equal(spy.args[0][0], 'test data');
                assert.equal(logging.error.called, true);
                // a one-off job without a name should not have persistance
                assert.equal(jobModelSpy.findOne.called, false);
            });
        });

        describe('Offloaded jobs', function () {
            it('accepts cron schedule when worker scheduling is stubbed', function () {
                sandbox.stub(jobManager.bree, 'add').returns();
                sandbox.stub(jobManager.bree, 'start').returns();

                const jobPath = path.resolve(__dirname, './jobs/simple.js');
                jobManager.addJob({
                    at: '* * * * * *',
                    job: jobPath,
                    name: 'cron-job'
                });

                assert.equal(jobManager.bree.add.called, true);
                assert.equal(jobManager.bree.start.called, true);
            });

            it('fails to schedule for invalid scheduling expression', function () {
                try {
                    jobManager.addJob({
                        at: 'invalid expression',
                        name: 'jobName'
                    });
                } catch (err) {
                    assert.equal(err.message, 'Invalid schedule format');
                }
            });

            it('fails to schedule for no job name', function () {
                try {
                    jobManager.addJob({
                        at: 'invalid expression',
                        job: () => {}
                    });
                } catch (err) {
                    assert.equal(err.message, 'Name parameter should be present if job is a function');
                }
            });

            it('schedules a job using date format', async function () {
                const timeInTenSeconds = new Date(Date.now() + 10);
                const jobPath = path.resolve(__dirname, './jobs/simple.js');

                const clock = FakeTimers.install({now: Date.now()});
                jobManager.addJob({
                    at: timeInTenSeconds,
                    job: jobPath,
                    name: 'job-in-ten'
                });

                assert.equal(typeof jobManager.bree.timeouts['job-in-ten'], 'object');
                assert.equal(typeof jobManager.bree.workers['job-in-ten'], 'undefined');

                // allow to run the job and start the worker
                await clock.nextAsync();

                assert.equal(typeof jobManager.bree.workers['job-in-ten'], 'object');

                const promise = new Promise((resolve, reject) => {
                    jobManager.bree.workers['job-in-ten'].on('error', reject);
                    jobManager.bree.workers['job-in-ten'].on('exit', (code) => {
                        assert.equal(code, 0);
                        resolve();
                    });
                });

                // allow job to finish execution and exit
                clock.next();

                await promise;

                assert.equal(typeof jobManager.bree.workers['job-in-ten'], 'undefined');

                clock.uninstall();
            });

            it('schedules a job to run immediately', async function () {
                const clock = FakeTimers.install({now: Date.now()});

                const jobPath = path.resolve(__dirname, './jobs/simple.js');
                jobManager.addJob({
                    job: jobPath,
                    name: 'job-now'
                });

                assert.equal(typeof jobManager.bree.timeouts['job-now'], 'object');

                // allow scheduler to pick up the job
                clock.tick(1);

                assert.equal(typeof jobManager.bree.workers['job-now'], 'object');

                const promise = new Promise((resolve, reject) => {
                    jobManager.bree.workers['job-now'].on('error', reject);
                    jobManager.bree.workers['job-now'].on('exit', (code) => {
                        assert.equal(code, 0);
                        resolve();
                    });
                });

                await promise;

                assert.equal(typeof jobManager.bree.workers['job-now'], 'undefined');

                clock.uninstall();
            });

            it('fails to schedule a job with the same name to run immediately one after another', async function () {
                const clock = FakeTimers.install({now: Date.now()});

                const jobPath = path.resolve(__dirname, './jobs/simple.js');
                jobManager.addJob({
                    job: jobPath,
                    name: 'job-now'
                });

                assert.equal(typeof jobManager.bree.timeouts['job-now'], 'object');

                // allow scheduler to pick up the job
                clock.tick(1);

                assert.equal(typeof jobManager.bree.workers['job-now'], 'object');

                const promise = new Promise((resolve, reject) => {
                    jobManager.bree.workers['job-now'].on('error', reject);
                    jobManager.bree.workers['job-now'].on('exit', (code) => {
                        assert.equal(code, 0);
                        resolve();
                    });
                });

                await promise;

                assert.equal(typeof jobManager.bree.workers['job-now'], 'undefined');

                assert.throws(() => {
                    jobManager.addJob({
                        job: jobPath,
                        name: 'job-now'
                    });
                }, /Job #1 has a duplicate job name of job-now/);

                clock.uninstall();
            });

            it('uses custom error handler when job fails', async function (){
                let job = function namedJob() {
                    throw new Error('job error');
                };
                const spyHandler = sinon.spy();
                jobManager = new JobManager({errorHandler: spyHandler, config: stubConfig});
                const completion = jobManager.awaitCompletion('will-fail');

                jobManager.addJob({
                    job,
                    name: 'will-fail'
                });

                await assert.rejects(completion, /job error/);

                assert.equal(spyHandler.called, true);
                assert.equal(spyHandler.args[0][0].message, 'job error');
                assert.equal(spyHandler.args[0][1].name, 'will-fail');
            });

            it('uses worker message handler when job sends a message', async function (){
                const workerMessageHandlerSpy = sinon.spy();
                jobManager = new JobManager({workerMessageHandler: workerMessageHandlerSpy, config: stubConfig});
                const completion = jobManager.awaitCompletion('will-send-msg');

                jobManager.addJob({
                    job: path.resolve(__dirname, './jobs/message.js'),
                    name: 'will-send-msg'
                });
                jobManager.bree.run('will-send-msg');
                await delay(100);
                jobManager.bree.workers['will-send-msg'].postMessage('hello from Ghost!');

                await completion;

                assert.equal(workerMessageHandlerSpy.called, true);
                assert.equal(workerMessageHandlerSpy.args[0][0].name, 'will-send-msg');
                assert.equal(workerMessageHandlerSpy.args[0][0].message, 'Worker received: hello from Ghost!');
            });
        });
    });

    describe('Add one off job', function () {
        it('throws if name parameter is not provided', async function () {
            try {
                await jobManager.addOneOffJob({
                    job: () => {}
                });
                throw new Error('should have thrown');
            } catch (err) {
                assert.equal(err.message, 'The name parameter is required for a one off job.');
            }
        });

        describe('Inline jobs', function () {
            it('can execute inline jobs provided as a module path', async function () {
                jobManager.addJob({
                    job: path.resolve(__dirname, './jobs/inline-module.js'),
                    data: 'test data',
                    offloaded: false
                });

                await delay(10);
                assert.equal(jobManager.inlineQueue.idle(), true);
            });

            it('handles failing inline jobs provided as a module path', async function () {
                const modulePath = path.resolve(__dirname, './jobs/inline-module-throws.js');
                jobManager.addJob({
                    job: modulePath,
                    offloaded: false
                });

                await delay(10);
                assert.equal(jobManager.inlineQueue.idle(), true);
                assert.equal(logging.error.called, true);
            });

            it('adds job to the queue when it is a unique one', async function () {
                const spy = sinon.spy();
                const JobModel = {
                    findOne: sinon.stub().resolves(undefined),
                    add: sinon.stub().resolves()
                };

                jobManager = new JobManager({JobModel, config: stubConfig});
                await jobManager.addOneOffJob({
                    job: spy,
                    name: 'unique name',
                    data: 'test data',
                    offloaded: false
                });

                assert.equal(JobModel.add.called, true);
            });

            it('does not add a job to the queue when it already exists', async function () {
                const spy = sinon.spy();
                const JobModel = {
                    findOne: sinon.stub().resolves(jobModelInstance),
                    add: sinon.stub().throws('should not be called')
                };

                jobManager = new JobManager({JobModel, config: stubConfig});

                try {
                    await jobManager.addOneOffJob({
                        job: spy,
                        name: 'I am the only one',
                        data: 'test data',
                        offloaded: false
                    });
                    throw new Error('should not reach this point');
                } catch (error) {
                    assert.equal(error.message, 'A "I am the only one" one off job has already been executed.');
                }
            });

            it('sets a finished state on an inline job', async function () {
                const JobModel = {
                    findOne: sinon.stub()
                        .onCall(0)
                        .resolves(null)
                        .resolves({id: 'unique', name: 'successful-oneoff'}),
                    add: sinon.stub().resolves({name: 'successful-oneoff'}),
                    edit: sinon.stub().resolves({name: 'successful-oneoff'})
                };

                jobManager = new JobManager({JobModel, config: stubConfig});
                const completion = jobManager.awaitCompletion('successful-oneoff');

                jobManager.addOneOffJob({
                    job: async () => {
                        return await delay(10);
                    },
                    name: 'successful-oneoff',
                    offloaded: false
                });

                await completion;

                // tracks the job queued
                assert.equal(JobModel.add.args[0][0].status, 'queued');
                assert.equal(JobModel.add.args[0][0].name, 'successful-oneoff');

                // tracks the job started
                assert.equal(JobModel.edit.args[0][0].status, 'started');
                assert.notEqual(JobModel.edit.args[0][0].started_at, undefined);
                assert.equal(JobModel.edit.args[0][1].id, 'unique');

                // tracks the job finish
                assert.equal(JobModel.edit.args[1][0].status, 'finished');
                assert.notEqual(JobModel.edit.args[1][0].finished_at, undefined);
                assert.equal(JobModel.edit.args[1][1].id, 'unique');
            });

            it('sets a failed state on a job', async function () {
                const JobModel = {
                    findOne: sinon.stub()
                        .onCall(0)
                        .resolves(null)
                        .resolves({id: 'unique', name: 'failed-oneoff'}),
                    add: sinon.stub().resolves({name: 'failed-oneoff'}),
                    edit: sinon.stub().resolves({name: 'failed-oneoff'})
                };

                let job = function namedJob() {
                    throw new Error('job error');
                };
                const spyHandler = sinon.spy();
                jobManager = new JobManager({errorHandler: spyHandler, JobModel, config: stubConfig});
                const completion = jobManager.awaitCompletion('failed-oneoff');

                await jobManager.addOneOffJob({
                    job,
                    name: 'failed-oneoff',
                    offloaded: false
                });

                await assert.rejects(completion, /job error/);

                // tracks the job start
                assert.equal(JobModel.edit.args[0][0].status, 'started');
                assert.notEqual(JobModel.edit.args[0][0].started_at, undefined);
                assert.equal(JobModel.edit.args[0][1].id, 'unique');

                // tracks the job failure
                assert.equal(JobModel.edit.args[1][0].status, 'failed');
                assert.equal(JobModel.edit.args[1][1].id, 'unique');
            });

            it('adds job to the queue after failing', async function () {
                const JobModel = {
                    findOne: sinon.stub()
                        .onCall(0)
                        .resolves(null)
                        .onCall(1)
                        .resolves({id: 'unique'})
                        .resolves({
                            id: 'unique',
                            get: (field) => {
                                if (field === 'status') {
                                    return 'failed';
                                }
                            }
                        }),
                    add: sinon.stub().resolves({}),
                    edit: sinon.stub().resolves()
                };

                let job = function namedJob() {
                    throw new Error('job error');
                };
                const spyHandler = sinon.spy();
                jobManager = new JobManager({errorHandler: spyHandler, JobModel, config: stubConfig});
                const completion1 = jobManager.awaitCompletion('failed-oneoff');

                await jobManager.addOneOffJob({
                    job,
                    name: 'failed-oneoff',
                    offloaded: false
                });

                // give time to execute the job and fail
                await assert.rejects(completion1, /job error/);
                assert.equal(JobModel.edit.args[1][0].status, 'failed');

                // simulate process restart and "fresh" slate to add the job
                jobManager.removeJob('failed-oneoff');
                const completion2 = jobManager.awaitCompletion('failed-oneoff');

                await jobManager.addOneOffJob({
                    job,
                    name: 'failed-oneoff',
                    offloaded: false
                });

                // give time to execute the job and fail AGAIN
                await assert.rejects(completion2, /job error/);
                assert.equal(JobModel.edit.args[3][0].status, 'started');
                assert.equal(JobModel.edit.args[4][0].status, 'failed');
            });
        });

        describe('Offloaded jobs', function () {
            it('adds job to the queue when it is a unique one', async function () {
                const spy = sinon.spy();
                const JobModel = {
                    findOne: sinon.stub().resolves(undefined),
                    add: sinon.stub().resolves()
                };

                jobManager = new JobManager({JobModel, config: stubConfig});
                await jobManager.addOneOffJob({
                    job: spy,
                    name: 'unique name',
                    data: 'test data'
                });

                assert.equal(JobModel.add.called, true);
            });

            it('does not add a job to the queue when it already exists', async function () {
                const spy = sinon.spy();
                const JobModel = {
                    findOne: sinon.stub().resolves(jobModelInstance),
                    add: sinon.stub().throws('should not be called')
                };

                jobManager = new JobManager({JobModel, config: stubConfig});

                try {
                    await jobManager.addOneOffJob({
                        job: spy,
                        name: 'I am the only one',
                        data: 'test data'
                    });
                    throw new Error('should not reach this point');
                } catch (error) {
                    assert.equal(error.message, 'A "I am the only one" one off job has already been executed.');
                }
            });

            it('sets a finished state on a job', async function () {
                const JobModel = {
                    findOne: sinon.stub()
                        .onCall(0)
                        .resolves(null)
                        .resolves({id: 'unique', name: 'successful-oneoff'}),
                    add: sinon.stub().resolves({name: 'successful-oneoff'}),
                    edit: sinon.stub().resolves({name: 'successful-oneoff'})
                };

                jobManager = new JobManager({JobModel, config: stubConfig});

                const jobCompletion = jobManager.awaitCompletion('successful-oneoff');

                await jobManager.addOneOffJob({
                    job: path.resolve(__dirname, './jobs/message.js'),
                    name: 'successful-oneoff'
                });

                // allow job to get picked up and executed
                await delay(100);

                jobManager.bree.workers['successful-oneoff'].postMessage('be done!');

                // allow the message to be passed around
                await jobCompletion;

                // tracks the job start
                assert.equal(JobModel.edit.args[0][0].status, 'started');
                assert.notEqual(JobModel.edit.args[0][0].started_at, undefined);
                assert.equal(JobModel.edit.args[0][1].id, 'unique');

                // tracks the job finish
                assert.equal(JobModel.edit.args[1][0].status, 'finished');
                assert.notEqual(JobModel.edit.args[1][0].finished_at, undefined);
                assert.equal(JobModel.edit.args[1][1].id, 'unique');
            });

            it('handles a failed job', async function () {
                const JobModel = {
                    findOne: sinon.stub()
                        .onCall(0)
                        .resolves(null)
                        .resolves(jobModelInstance),
                    add: sinon.stub().resolves({name: 'failed-oneoff'}),
                    edit: sinon.stub().resolves({name: 'failed-oneoff'})
                };

                let job = function namedJob() {
                    throw new Error('job error');
                };
                const spyHandler = sinon.spy();
                jobManager = new JobManager({errorHandler: spyHandler, JobModel, config: stubConfig});

                const completion = jobManager.awaitCompletion('failed-oneoff');

                await jobManager.addOneOffJob({
                    job,
                    name: 'failed-oneoff'
                });

                await assert.rejects(completion, /job error/);

                // still calls the original error handler
                assert.equal(spyHandler.called, true);
                assert.equal(spyHandler.args[0][0].message, 'job error');
                assert.equal(spyHandler.args[0][1].name, 'failed-oneoff');

                // tracks the job start
                assert.equal(JobModel.edit.args[0][0].status, 'started');
                assert.notEqual(JobModel.edit.args[0][0].started_at, undefined);
                assert.equal(JobModel.edit.args[0][1].id, 'unique');

                // tracks the job failure
                assert.equal(JobModel.edit.args[1][0].status, 'failed');
                assert.equal(JobModel.edit.args[1][1].id, 'unique');
            });
        });
    });

    describe('Job execution progress', function () {
        it('returns false when persistence is not configured', async function () {
            jobManager = new JobManager({config: stubConfig});
            const executed = await jobManager.hasExecutedSuccessfully('no-repo-job');
            assert.equal(executed, false);
        });

        it('checks if job has ever been executed', async function () {
            const JobModel = {
                findOne: sinon.stub()
                    .withArgs('solovei')
                    .onCall(0)
                    .resolves(null)
                    .onCall(1)
                    .resolves({
                        id: 'unique',
                        get: (field) => {
                            if (field === 'status') {
                                return 'finished';
                            }
                        }
                    })
                    .onCall(2)
                    .resolves({
                        id: 'unique',
                        get: (field) => {
                            if (field === 'status') {
                                return 'failed';
                            }
                        }
                    })
            };

            jobManager = new JobManager({JobModel, config: stubConfig});
            let executed = await jobManager.hasExecutedSuccessfully('solovei');
            assert.equal(executed, false);

            executed = await jobManager.hasExecutedSuccessfully('solovei');
            assert.equal(executed, true);

            executed = await jobManager.hasExecutedSuccessfully('solovei');
            assert.equal(executed, false);
        });

        it('can wait for job completion', async function () {
            const spy = sinon.spy();
            let status = 'queued';
            const jobWithDelay = async () => {
                await delay(80);
                status = 'finished';
                spy();
            };
            const JobModel = {
                findOne: sinon.stub()
                    // first call when adding a job
                    .withArgs('solovei')
                    .onCall(0)
                    // first call when adding a job
                    .resolves(null)
                    .onCall(1)
                    .resolves(null)
                    .resolves({
                        id: 'unique',
                        get: () => status
                    }),
                add: sinon.stub().resolves()
            };

            jobManager = new JobManager({JobModel, config: stubConfig});

            await jobManager.addOneOffJob({
                job: jobWithDelay,
                name: 'solovei',
                offloaded: false
            });

            assert.equal(spy.called, false);
            await jobManager.awaitOneOffCompletion('solovei');
            assert.equal(spy.called, true);
        });
    });

    describe('Remove a job', function () {
        it('removes a scheduled job from the queue', async function () {
            jobManager = new JobManager({config: stubConfig});

            const timeInTenSeconds = new Date(Date.now() + 10);
            const jobPath = path.resolve(__dirname, './jobs/simple.js');

            jobManager.addJob({
                at: timeInTenSeconds,
                job: jobPath,
                name: 'job-in-ten'
            });
            assert.equal(jobManager.bree.config.jobs[0].name, 'job-in-ten');

            await jobManager.removeJob('job-in-ten');

            assert.equal(jobManager.bree.config.jobs[0], undefined);
        });
    });

    describe('Shutdown', function () {
        it('gracefully shuts down inline jobs', async function () {
            jobManager = new JobManager({config: stubConfig});

            jobManager.addJob({
                job: require('./jobs/timed-job'),
                data: 200,
                offloaded: false
            });

            assert.equal(jobManager.inlineQueue.idle(), false);

            await jobManager.shutdown();

            assert.equal(jobManager.inlineQueue.idle(), true);
        });

        it('gracefully shuts down an interval job', async function () {
            jobManager = new JobManager({config: stubConfig});

            jobManager.addJob({
                at: 'every 5 seconds',
                job: path.resolve(__dirname, './jobs/graceful.js')
            });

            await delay(1); // let the job execution kick in

            assert.equal(Object.keys(jobManager.bree.workers).length, 0);
            assert.equal(Object.keys(jobManager.bree.timeouts).length, 0);
            assert.equal(Object.keys(jobManager.bree.intervals).length, 1);

            await jobManager.shutdown();

            assert.equal(Object.keys(jobManager.bree.intervals).length, 0);
        });

        it('gracefully shuts down the job queue worker pool');
    });

    describe('allSettled', function () {
        it('resolves immediately when queue is idle', async function () {
            await assert.doesNotReject(() => jobManager.allSettled());
        });

        it('resolves once queued inline job completes', async function () {
            jobManager.addJob({
                name: 'inline-all-settled',
                job: async () => {
                    await delay(10);
                },
                offloaded: false
            });

            await assert.doesNotReject(() => jobManager.allSettled());
            assert.equal(jobManager.inlineQueue.idle(), true);
        });
    });

    describe('Unit helpers', function () {
        it('_jobMessageHandler dispatches domain events from worker messages', async function () {
            const domainEvents = {
                dispatchRaw: sinon.spy()
            };
            jobManager = new JobManager({config: stubConfig, domainEvents});

            await jobManager._jobMessageHandler({
                name: 'event-job',
                message: {
                    event: {
                        type: 'my-event',
                        data: {foo: 'bar'}
                    }
                }
            });

            assert.equal(domainEvents.dispatchRaw.calledOnce, true);
            assert.deepEqual(domainEvents.dispatchRaw.args[0], ['my-event', {foo: 'bar'}]);
        });

        it('_jobErrorHandler rejects allSettled listeners', async function () {
            sandbox.stub(jobManager.inlineQueue, 'idle').returns(false);
            const all = jobManager.allSettled();

            await jobManager._jobErrorHandler(new Error('all failed'), {name: 'no-op'});

            await assert.rejects(all, /all failed/);
        });

        it('assembleBreeJob supports cron expressions', function () {
            const job = assembleBreeJob('* * * * * *', '/tmp/job.js', {foo: 'bar'}, 'cron-job');
            assert.equal(job.cron, '* * * * * *');
            assert.equal(job.interval, undefined);
            assert.equal(job.date, undefined);
        });

        it('JobsRepository delete handles model delete errors', async function () {
            const JobModel = {
                destroy: sinon.stub().rejects(new Error('destroy failed'))
            };
            const repository = new JobsRepository({JobModel});

            await assert.doesNotReject(() => repository.delete('abc'));
            assert.equal(logging.error.called, true);
        });

        it('JobsRepository delete resolves when model delete succeeds', async function () {
            const JobModel = {
                destroy: sinon.stub().resolves()
            };
            const repository = new JobsRepository({JobModel});

            await assert.doesNotReject(() => repository.delete('abc'));
            assert.equal(JobModel.destroy.calledOnce, true);
        });
    });
});
