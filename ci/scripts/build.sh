#!/bin/bash -eux

pushd dis-authorisation-client-js
  npm ci --silent
  make build

  # copy build to the location expected by the CI
  cp -r build package.json package-lock.json ../build
popd
