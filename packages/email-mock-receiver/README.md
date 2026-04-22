# Email Mock Receiver

Mocks email sending method and manages snapshots for outgoing email information such as to addresses, html content of emails, etc.

## Install

`npm install @tryghost/email-mock-receiver --save`

or

`pnpm add @tryghost/email-mock-receiver`

## Purpose

Test helper that captures outbound email payloads for assertions in automated tests.

## Usage

## Develop

This is a monorepo package.

Follow the instructions for the top-level repo.

1. `git clone` this repo & `cd` into it as usual
2. Run `pnpm install` to install top-level dependencies.

## Test

- `pnpm lint` runs oxlint
- `pnpm test` runs lint and tests
