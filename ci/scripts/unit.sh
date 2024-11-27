#!/bin/bash -eux

pushd dis-authorisation-client-js
  npm install --silent
  make test
popd
