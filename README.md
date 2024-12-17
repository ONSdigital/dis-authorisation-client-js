# dis-authorisation-client-js

JS library for client side token renewal

## Getting started

* Run `make help` to see full list of make targets

## Usage

1. Setting Session Expiry Time Directly (Without Configuration)
You can manually set the session and refresh expiry times using `setSessionExpiryTime`. If `init` has not been called yet, the library will automatically initialise with default settings:

```
import SessionManagement from 'session-management-library';

// Define session and refresh expiry times
const sessionExpiryTime = new Date(new Date().getTime() + 60 * 60 * 1000); // 1 hour from now
const refreshExpiryTime = new Date(new Date().getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

// Set the expiry timers
SessionManagement.setSessionExpiryTime(sessionExpiryTime, refreshExpiryTime);
```

2. Initialising with Custom Configuration
You can call `init` with a custom config, this allows you to specify callbacks and settings:

```
import SessionManagement from 'session-management-library';

// Define configuration
const config = {
  timeOffsets: { passiveRenewal: 300000 }, // Session renewal offset: 5 minutes
  checkSessionOnInit: true, // Check session status on initialisation
  onRenewSuccess: (expiryTime) => {
    console.log(`[APP] Session renewed successfully! New expiry: ${expiryTime}`);
  },
  onRenewFailure: (error) => {
    console.error('[APP] Session renewal failed:', error);
  },
  onSessionValid: (sessionExpiryTime) => {
    console.log(`[APP] Session is valid until: ${sessionExpiryTime}`);
  },
  onSessionInvalid: () => {
    console.warn('[APP] Session is invalid.');
  },
};

// Initialise the SessionManagement library
SessionManagement.init(config);

// Set session expiry times after initialisation
const sessionExpiryTime = new Date(new Date().getTime() + 60 * 60 * 1000); // 1 hour
const refreshExpiryTime = new Date(new Date().getTime() + 24 * 60 * 60 * 1000); // 24 hours

SessionManagement.setSessionExpiryTime(sessionExpiryTime, refreshExpiryTime);
```

### Dependencies

* No further dependencies other than those defined in `package.json`

## Configuration

### defaultConfig

| Option              | Type     | Default Value | Description                                                                 |
|---------------------|----------|---------------|-----------------------------------------------------------------------------|
| `timeOffsets`       | Object   | `{ passiveRenewal: 300000 }` | Time offsets for session renewal in milliseconds.                           |
| `onRenewSuccess`    | Function | `() => console.log('[LIBRARY] Session renewed successfully')` | Callback function to be called on successful session renewal.               |
| `onRenewFailure`    | Function | `() => console.warn('[LIBRARY] Session renewal failed')` | Callback function to be called on session renewal failure.                  |
| `onSessionValid`    | Function | `(sessionExpiryTime) => console.log('[LIBRARY] Session valid until: ${sessionExpiryTime}')` | Callback function to be called when the session is valid.                   |
| `onSessionInvalid`  | Function | `() => console.warn('[LIBRARY] Session is invalid')` | Callback function to be called when the session is invalid.                 |
| `onError`           | Function | `(error) => console.error('[LIBRARY] Error:', error)` | Callback function to be called on error.                                    |
| `checkSessionOnInit`| Boolean  | `false`        | Whether to check the session status on initialization.                      |

### apiConfig

| Option               | Type     | Default Value                 | Description                                                                 |
|----------------------|----------|-------------------------------|-----------------------------------------------------------------------------|
| `RENEW_SESSION`      | String   | `/tokens/self`               | The API endpoint for renewing the session.                                  |
| `CHECK_SESSION`      | String   | `/tokens/self`               | The API endpoint for checking the session status.                           |


## Contributing

See [CONTRIBUTING](CONTRIBUTING.md) for details.

## License

Copyright © 2024, Office for National Statistics (https://www.ons.gov.uk)

Released under MIT license, see [LICENSE](LICENSE.md) for details.
