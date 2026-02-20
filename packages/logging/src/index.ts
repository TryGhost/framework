import path from 'path';
import {isMainThread} from 'worker_threads';
import {getProcessRoot} from '@tryghost/root-utils';
import GhostLogger, {GhostLoggerOptions} from './GhostLogger';

let loggingConfig: GhostLoggerOptions;
try {
    loggingConfig = require(path.join(getProcessRoot(), 'loggingrc')) as GhostLoggerOptions; // eslint-disable-line @typescript-eslint/no-require-imports
} catch {
    loggingConfig = {};
}

if (!isMainThread) {
    loggingConfig.transports = ['parent'];
}

const logger = Object.assign(new GhostLogger(loggingConfig), {GhostLogger});

export = logger;
