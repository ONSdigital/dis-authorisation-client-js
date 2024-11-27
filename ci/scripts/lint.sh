#!/bin/bash -eux

pushd dis-authorisation-client-js
  npm ci --silent
  make lint
popd
