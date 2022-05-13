FROM docker:dind

RUN apk --update --no-cache add \
curl \
git \
nano \
vim \
w3m

# Create a group and user
RUN addgroup -S docker && adduser -S dude -G docker
# USER dude
COPY dindWithShell.sh /
WORKDIR /dind 
ENTRYPOINT  /dindWithShell.sh
