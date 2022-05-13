#!/bin/sh

echo "build custom image"
docker build -t dind-sandbox .
echo "start ssh server"
node index.js
