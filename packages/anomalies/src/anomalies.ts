export type AnomalyCategory =
  | 'unavailable'
  | 'interrupted'
  | 'busy'
  | 'incorrect'
  | 'forbidden'
  | 'unsupported'
  | 'not-found'
  | 'conflict'
  | 'fault';

class Anomaly extends Error {
    public readonly category: AnomalyCategory;
    public readonly retryable: boolean;

    constructor(category: AnomalyCategory, message?: string, retryable?: boolean) {
        const defaultMessage = getDefaultMessage(category);
        super(message || defaultMessage);

        this.name = 'Anomaly';
        this.category = category;
        this.retryable = retryable || getRetryable(category);
    }
}

export class UnavailableAnomaly extends Anomaly {
    constructor(message?: string) {
        super('unavailable', message);
    }
}

export class InterruptedAnomaly extends Anomaly {
    constructor(message?: string, retryable?: boolean) {
        super('interrupted', message, retryable);
    }
}

export class BusyAnomaly extends Anomaly {
    constructor(message?: string) {
        super('busy', message);
    }
}

export class IncorrectAnomaly extends Anomaly {
    constructor(message?: string) {
        super('incorrect', message);
    }
}

export class ForbiddenAnomaly extends Anomaly {
    constructor(message?: string) {
        super('forbidden', message);
    }
}

export class UnsupportedAnomaly extends Anomaly {
    constructor(message?: string) {
        super('unsupported', message);
    }
}

export class NotFoundAnomaly extends Anomaly {
    constructor(message?: string) {
        super('not-found', message);
    }
}

export class ConflictAnomaly extends Anomaly {
    constructor(message?: string) {
        super('conflict', message);
    }
}

export class FaultAnomaly extends Anomaly {
    constructor(message?: string, retryable?: boolean) {
        super('fault', message, retryable);
    }
}

function getDefaultMessage(category: AnomalyCategory): string {
    switch (category) {
    case 'unavailable':
        return 'Service is unavailable';
    case 'interrupted':
        return 'Operation was interrupted';
    case 'busy':
        return 'Service is busy';
    case 'incorrect':
        return 'Request is incorrect';
    case 'forbidden':
        return 'Access forbidden';
    case 'unsupported':
        return 'Operation not supported';
    case 'not-found':
        return 'Resource not found';
    case 'conflict':
        return 'Request conflicts with current state';
    case 'fault':
        return 'Internal service fault';
    }
}

function getRetryable(category: AnomalyCategory): boolean {
    switch (category) {
    case 'unavailable':
    case 'busy':
        return true;
    case 'interrupted':
    case 'fault':
        // "Maybe" results are false by default, but overridable on creation
        return false;
    case 'incorrect':
    case 'forbidden':
    case 'unsupported':
    case 'not-found':
    case 'conflict':
        return false;
    }
}

export function isAnomaly(error: any): error is Anomaly {
    return error instanceof Anomaly;
}
