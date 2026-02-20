import assert from 'assert/strict';
import {MetricsServer} from '../src';
import express from 'express';
import * as sinon from 'sinon';

type FakeApp = {
    get: sinon.SinonStub;
    listen: sinon.SinonStub;
};

type FakeStoppableServer = {
    listening: boolean;
    stop: sinon.SinonStub;
};

describe('Metrics Server', function () {
    let metricsServer: MetricsServer;
    let serverConfig = {
        host: '127.0.0.1',
        port: 9416
    };
    let handler = (req: express.Request, res: express.Response) => {
        res.send('metrics');
    };

    let fakeApp: FakeApp;
    let fakeHttpServer: Record<string, unknown>;
    let fakeStoppableServer: FakeStoppableServer;
    let createAppStub: sinon.SinonStub;
    let createStoppableServerStub: sinon.SinonStub;

    beforeEach(function () {
        fakeHttpServer = {};
        fakeApp = {
            get: sinon.stub(),
            listen: sinon.stub()
        };
        fakeApp.listen.callsFake((port: number, host: string, cb?: () => void) => {
            cb?.();
            return fakeHttpServer;
        });

        fakeStoppableServer = {
            listening: true,
            stop: sinon.stub().resolves()
        };

        createAppStub = sinon.stub().returns(fakeApp);
        createStoppableServerStub = sinon.stub().returns(fakeStoppableServer);

        metricsServer = new MetricsServer({
            serverConfig,
            handler,
            createApp: createAppStub,
            createStoppableServer: createStoppableServerStub
        });
    });

    afterEach(async function () {
        sinon.restore();
        await metricsServer.stop();
    });

    after(async function () {
        await metricsServer.shutdown();
    });

    describe('constructor', function () {
        it('should create a new instance', function () {
            assert.ok(metricsServer);
        });

        it('should support default server factories', function () {
            const instance = new MetricsServer({serverConfig, handler});
            assert.ok(instance);
        });
    });

    describe('start', function () {
        it('should start the server', async function () {
            const server = await metricsServer.start();
            assert.ok(server);
            sinon.assert.calledOnce(createAppStub);
            sinon.assert.calledOnceWithExactly(fakeApp.get, '/metrics', handler);
            sinon.assert.calledOnceWithExactly(fakeApp.listen, serverConfig.port, serverConfig.host, sinon.match.func);
            sinon.assert.calledOnceWithExactly(createStoppableServerStub, fakeHttpServer, 0);
        });

        it('should use the provided handler', async function () {
            const {app} = await metricsServer.start();
            assert.equal(app, fakeApp as unknown as express.Application);
        });

        it('should register shutdown handlers for SIGINT and SIGTERM', async function () {
            const processOnStub = sinon.stub(process, 'on');
            const shutdownStub = sinon.stub(metricsServer, 'shutdown').resolves();

            await metricsServer.start();

            sinon.assert.calledTwice(processOnStub);
            assert.equal(processOnStub.firstCall.args[0], 'SIGINT');
            assert.equal(processOnStub.secondCall.args[0], 'SIGTERM');

            await processOnStub.firstCall.args[1]();
            await processOnStub.secondCall.args[1]();
            sinon.assert.calledTwice(shutdownStub);
        });
    });

    describe('stop', function () {
        it('should stop the server', async function () {
            const server = await metricsServer.start();
            await metricsServer.stop();
            assert.ok(server);
            sinon.assert.calledOnce(fakeStoppableServer.stop);
        });

        it('should not stop when server is not listening', async function () {
            await metricsServer.start();
            fakeStoppableServer.listening = false;
            await metricsServer.stop();
            sinon.assert.notCalled(fakeStoppableServer.stop);
        });
    });

    describe('shutdown', function () {
        it('should shutdown the server', async function () {
            const server = await metricsServer.start();
            await metricsServer.shutdown();
            assert.ok(server);
            sinon.assert.calledOnce(fakeStoppableServer.stop);
        });

        it('should not shutdown the server if it is already shutting down', async function () {
            const stopSpy = sinon.spy(metricsServer, 'stop');
            await metricsServer.start();
            await Promise.all([metricsServer.shutdown(), metricsServer.shutdown()]);
            sinon.assert.calledOnce(stopSpy);
        });
    });
});
