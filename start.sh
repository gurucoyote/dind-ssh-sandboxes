#!/bin/sh
docker run \
	--privileged --rm -ti \
	--name $1 --hostname $1 \
	dam ash -l

