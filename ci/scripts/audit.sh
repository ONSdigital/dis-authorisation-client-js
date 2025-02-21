#!/bin/bash -eux

pushd dis-authorisation-client-js
  npm install
  make audit
popd
