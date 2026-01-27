# Nodemailer

This is a wrapper around the [nodemailer](https://nodemailer.com/) module for use internally by [Ghost](https://ghost.org/). It is not intended to be installed or used outside of Ghost.

See the [official docs for configurating transaction email sending for Ghost](https://ghost.org/docs/config/#mail).

## Description

Provides pre-configured transport options for common transport services.

### Supported Transport Types

1. `smtp` - send via SMTP server.
  *  Detects when service: 'sendmail' is used and enables sendmail mode

2. `mailgun` - Allows using Mailgun with API key instead of via SMTP.
  *  `auth: { api_key: 'your-mailgun-api-key' }`
  * Defaults to 60-second timeout.

3. `sendmail` - use local sendmail binary.

4. `ses` - [Send via AWS SES](https://ghost.org/docs/config/#amazon-ses).

5. `direct` - Attempt to connect directly to remote SMTP servers. This is the default and requires no configuration, but is more likely to be blocked by remote mail services.

6. `stub` - For testing and development. Doesn't actually send mail.

Other Nodemailer transports are not supported.

## Develop

This is a mono repository, managed with [lerna](https://lernajs.io/).

Follow the instructions for the top-level repo.
1. `git clone` this repo & `cd` into it as usual
2. Run `yarn` to install top-level dependencies.


## Run

- `yarn dev`


## Test

- `yarn lint` run just eslint
- `yarn test` run lint and tests




# Copyright & License 

Copyright (c) 2013-2026 Ghost Foundation - Released under the [MIT license](LICENSE).