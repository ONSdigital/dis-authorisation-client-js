#!/bin/bash -eux

pushd dis-authorisation-client-js
  npm ci
  make test
popd
