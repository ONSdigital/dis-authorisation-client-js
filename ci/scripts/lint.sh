#!/bin/bash -eux

pushd dis-authorisation-client-js
  npm install
  npm ci
  make lint
popd
