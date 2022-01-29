const { createServer } = require("http");
const { execute, subscribe } = require("graphql");
const { SubscriptionServer } = require("subscriptions-transport-ws");
const { makeExecutableSchema } = require("@graphql-tools/schema");
const express = require("express");
const { ApolloServer } = require("apollo-server-express");
const resolvers = require("./graphql/resolvers");
const typeDefs = require("./graphql/typeDefs");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { PubSub } = require("graphql-subscriptions");
const pubsub = new PubSub();

(async function () {
  const app = express();

  const httpServer = createServer(app);

  const schema = makeExecutableSchema({
    typeDefs,
    resolvers,
  });

  const subscriptionServer = SubscriptionServer.create(
    {
      schema,
      execute,
      subscribe,
      onConnect: ({ Authorization }) => {
        let user;
        let token;
        if (Authorization) {
          token = Authorization.split("Bearer ")[1];
        }

        if (token) {
          jwt.verify(token, process.env.JWT_SECRET, (err, decodedToken) => {
            return (user = decodedToken);
          });
        }
        return { user, pubsub };
      },
    },
    { server: httpServer, path: "/subscriptions" }
  );

  const server = new ApolloServer({
    schema,
    context: ({ req }) => {
      let user;
      let token;
      if (req.headers.authorization) {
        token = req.headers.authorization.split("Bearer ")[1];
      }

      if (token) {
        jwt.verify(token, process.env.JWT_SECRET, (err, decodedToken) => {
          return (user = decodedToken);
        });
      }
      return { user, pubsub };
    },
    plugins: [
      {
        async serverWillStart() {
          return {
            async drainServer() {
              subscriptionServer.close();
            },
          };
        },
      },
    ],
  });

  app.get("/", (req, res) => {
    res.json("your server is running smoothly");
  });

  app.use(
    cors({
      credentials: true,
      origin: "*",
      optionsSuccessStatus: 200,
    })
  );
  await server.start();
  server.applyMiddleware({ app });
  const PORT = 4000;
  httpServer.listen({ port: process.env.PORT || PORT }, () => {
    mongoose
      .connect(process.env.mongoURL, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      })
      .then(() => console.log("MongoDB Connected..."))
      .catch((err) =>
        console.log(
          "You seems to have poor internet or your mongourl is not correct, try again...",
          err
        )
      );
    console.log(
      `Server is now running on http://localhost:${PORT}${server.graphqlPath}`
    );
  });
})();
