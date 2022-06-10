# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.0.2 - 2022-05-24

### node-client

#### Fixed

- Client closes device correctly which allows Node.JS process to end

#### Technical stuff

- USB reader is not paused anymore while client writes to device because `usb` dependency does not use a semaphore anymore

## 1.0.1 - 2022-05-20

### node-client

#### Fixed

- `@eove/his-node-client` default export works now

## 1.0.0 - 2022-05-02

### node-client

#### Added

- Client provides an authentication token to HIS server

## 0.9.0 - 2022-04-08

### Added

- initial version
