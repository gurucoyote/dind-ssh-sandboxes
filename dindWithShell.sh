#!/bin/ash
echo "starting dockerd"
dockerd &> dockerd.log &
echo "starting shell"
ash -l
