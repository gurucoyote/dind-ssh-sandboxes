FROM docker:dind

RUN apk --update --no-cache add \
curl \
nano \
vim \
w3m

# Create a group and user
RUN addgroup -S docker && adduser -S dude -G docker
# USER dude
WORKDIR /dind 
