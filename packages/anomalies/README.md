# Anomalies

Simple, categorical errors designed to be actionable

Based on the [Cognitect Labs anomalies library](https://github.com/cognitect-labs/anomalies/tree/master)

## Install

`npm install @tryghost/anomalies --save`

or

`yarn add @tryghost/anomalies`

## Usage

This library provides categorical error types that are designed to be actionable. Each anomaly has a category and a retryable status to help with error handling and recovery strategies.

### Basic Usage

```typescript
import { 
  UnavailableAnomaly, 
  NotFoundAnomaly, 
  ForbiddenAnomaly,
  InterruptedAnomaly,
  FaultAnomaly,
  isAnomaly
} from '@tryghost/anomalies';

// Throw specific anomaly types
throw new UnavailableAnomaly('Database connection failed');
throw new NotFoundAnomaly('User not found');
throw new ForbiddenAnomaly('Access denied');

// Override retryable for InterruptedAnomaly and FaultAnomaly
throw new InterruptedAnomaly('Connection interrupted', true); // Make it retryable
throw new FaultAnomaly('Service fault', false); // Make it non-retryable

// Check if an error is an anomaly
try {
  // some operation
} catch (error) {
  if (isAnomaly(error)) {
    console.log(`Category: ${error.category}`);
    console.log(`Retryable: ${error.retryable}`);
  }
}
```

### Available Anomaly Types

| Anomaly Class | Category | Retryable |
|---------------|----------|-----------|
| `UnavailableAnomaly` | `unavailable` | yes |
| `BusyAnomaly` | `busy` | yes |
| `InterruptedAnomaly` | `interrupted` | maybe* |
| `FaultAnomaly` | `fault` | maybe* |
| `IncorrectAnomaly` | `incorrect` | no |
| `ForbiddenAnomaly` | `forbidden` | no |
| `UnsupportedAnomaly` | `unsupported` | no |
| `NotFoundAnomaly` | `not-found` | no |
| `ConflictAnomaly` | `conflict` | no |

*Defaults to false, but can be overridden during construction

### Retryable Status

Each anomaly has a boolean `retryable` property that indicates whether the operation could be retried with a different outcome:

- `true`: Operation should be retried
- `false`: Operation should not be retried

For `InterruptedAnomaly` and `FaultAnomaly`, you can override the default retryable behavior by passing a boolean as the second parameter to the constructor.

For more information about the approach, see the [Cognitect Labs anomalies library](https://github.com/cognitect-labs/anomalies).

### Error Handling Pattern

```typescript
import { 
  UnavailableAnomaly, 
  NotFoundAnomaly, 
  ForbiddenAnomaly,
  BusyAnomaly 
} from '@tryghost/anomalies';

async function fetchUser(id: string) {
  try {
    return await userService.getUser(id);
  } catch (error) {
    if (error instanceof NotFoundAnomaly) {
      // Handle missing user
      console.log('User not found, creating default user');
      return createDefaultUser();
    } else if (error instanceof ForbiddenAnomaly) {
      // Handle access denied
      console.error('Access denied for user:', id);
      throw error; // Re-throw for caller to handle
    } else if (error instanceof UnavailableAnomaly || error instanceof BusyAnomaly) {
      // Handle retryable errors
      console.log('Service unavailable, retrying...');
      await delay(1000);
      return fetchUser(id); // Retry
    } else if (error instanceof InterruptedAnomaly && error.retryable) {
      // Handle interrupted operation that's marked as retryable
      console.log('Operation interrupted but retryable, retrying...');
      await delay(500);
      return fetchUser(id); // Retry
    } else {
      // Handle unexpected errors
      throw error;
    }
  }
}
```


## Develop

This is a monorepo package.

Follow the instructions for the top-level repo.
1. `git clone` this repo & `cd` into it as usual
2. Run `yarn` to install top-level dependencies.



## Test

- `yarn lint` run just eslint
- `yarn test` run lint and tests
