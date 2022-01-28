const { gql } = require("apollo-server");

module.exports = gql`
  type latestMessage {
    content: String
    createdAt: String
  }
  type User {
    name: String
    username: String
    email: String
    createdAt: String
    token: String
    latestMessage: latestMessage
  }

  type Success {
    success: Boolean
  }
  type Message {
    content: String!
    from: String!
    to: String!
    createdAt: String!
  }

  type Query {
    getUsers: [User]!
    login(username: String!, password: String!): User!
    getMessages(from: String!): [Message]!
  }
  type Mutation {
    register(
      name: String!
      username: String!
      email: String!
      password: String!
      confirmPassword: String!
    ): Success!
    sendMessage(to: String!, content: String!): Message!
  }
  type Subscription {
    newMessage: Message!
  }
`;
