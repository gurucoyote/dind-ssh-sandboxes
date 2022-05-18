import fs from "fs";
import util from "util";
import EventEmitter from "events";

import Docker from "dockerode";
import ssh2 from "ssh2";
import NodeRSA from "node-rsa";

const docker = new Docker();

// Generate a temporary, throwaway private key.
// const key = new NodeRSA({b: 1024})
// const privKey = key.exportKey('pkcs1-private-pem')
// rather read the same key each time
// generate with ssh-keygen -m PEM -t rsa -b 2048
const privKey = fs.readFileSync("host.key");

const TIMEOUT = 60000 * 30;
let username = "me";
const port = 2222;

new ssh2.Server(
  {
    hostKeys: [privKey],
    banner: "Welcome to the docker-in-docker ssh sandbox!",
    ident: "ssh-sandboxes",
  },
  (client) => {
    console.log(
      "Client connected!",
      client._sock._peername.address,
      ":",
      client._sock._peername.port
    );
    client
      .on("error", (e) => {
        console.error("error caught", e);
      })
      .on("authentication", (ctx) => {
        try {
          console.log("authenticating");
          // Blindly accept all connections
          ctx.accept();
          username = ctx.username;
        } catch (e) {
          console.error("auth error: ", e);
        }
      })
      .on("ready", () => {
        console.log("Client authenticated!");
        client.on("session", function (accept, reject) {
          console.log("Client wants new session");
          var session = accept();
          session.once("pty", (accept, reject, info) => {
            accept();
          });
          session.once("shell", (accept, reject) => {
            console.log("Client wants a shell!");
            let container = null;

            // Accept the connection and get a bidirectional stream.
            const stream = accept();

            var cleanupStream = function () {
              if (stream.timeoutId) {
                clearTimeout(stream.timeoutId);
              }

              if (container) {
                container.remove({ force: true }, function (err, data) {
                  if (err) {
                    console.log(
                      "Error removing container %s: %s",
                      container.id,
                      err
                    );
                  }
                  console.log("Removed container");
                });
              }
            };

            docker.createContainer(
              {
                Cmd: ["/bin/ash", "-l"],
                Image: "dind-sandbox",
                hostname: username,
                // name: username, // TODO make sure this container name doesn't already exist
                privileged: true,
                Binds: [`${process.cwd()}/home/${username}:/home/${username}`],
                WorkingDir: `/home/${username}`,
                OpenStdin: true,
                Tty: true,
              },
              function (err, theContainer) {
                if (err) {
                  console.log(err);
                  closeStream();
                  return;
                }

                container = theContainer;
                container.attach(
                  {
                    stream: true,
                    stdin: true,
                    stdout: true,
                    stderr: true,
                  },
                  function (err, ttyStream) {
                    console.log("Attached to container " + theContainer.id);
                    // Attach output streams to client stream.
                    ttyStream.pipe(stream);

                    // Attach client stream to stdin of container
                    stream.pipe(ttyStream);

                    // Start the container
                    theContainer.start((err, _) => {
                      if (err) {
                        console.error("Unable to start container", err);
                        closeStream();
                        return;
                      }
                      // console.log("Container started!");
                    });
                  }
                );
              }
            );

            const onTimeout = function () {
              console.log("Closing session due to timeout");
              stream.close();
            };

            stream.on("data", function (_) {
              // Reset timeout
              if (stream.timeoutId) {
                clearTimeout(stream.timeoutId);
              }
              stream.timeoutId = setTimeout(onTimeout, TIMEOUT);
            });

            stream.on("end", () => {
              console.log("Stream disconnected!");
              cleanupStream();
            });
          });
        });
      })
      .on("abort", () => {
        console.log("Client aborted!");
      })
      .on("end", () => {
        console.log("Client disconnected!");
      });
  }
).listen(port, "0.0.0.0", function () {
  console.log("Listening on port " + this.address().port, this.address());
});
