const {
  UserInputError,
  AuthenticationError,

  withFilter,
} = require("apollo-server");

const Message = require("../../models/message");
const User = require("../../models/user");

module.exports = {
  Query: {
    getMessages: async (parent, { from }, { user }) => {
      try {
        if (!user) throw new AuthenticationError("Unauthenticated");

        const otherUser = await User.findOne({ email: from });
        if (!otherUser) throw new UserInputError("User not found");

        const users = [user.user.email, otherUser.email];

        const pipeline = [
          {
            $match: { from: { $in: users } },
          },
          {
            $match: { to: { $in: users } },
          },
          {
            $sort: {
              createdAt: 1,
            },
          },
        ];
        const messages = await Message.aggregate(pipeline);

        return messages;
      } catch (err) {
        console.log(err);
        throw err;
      }
    },
  },
  Mutation: {
    sendMessage: async (parent, { to, content }, context) => {
      const user = context.user;
      const pubsub = context.pubsub;

      try {
        if (!user) throw new AuthenticationError("Unauthenticated");

        const recipient = await User.findOne({ email: to });

        if (!recipient) {
          throw new UserInputError("User not found");
        } else if (recipient.username === user.user.username) {
          throw new UserInputError("You cant message yourself");
        }

        if (content.trim() === "") {
          throw new UserInputError("Message is empty");
        }

        const newmessage = new Message({ content, from: user.user.email, to });
        const message = await newmessage.save();
        pubsub.publish("NEW_MESSAGE", { newMessage: message });
        return message;
      } catch (err) {
        console.log(err);
        throw err;
      }
    },
  },
  Subscription: {
    newMessage: {
      subscribe: withFilter(
        (_, __, { pubsub, user }) => {
          if (!user) throw new AuthenticationError("Unauthenticated");
          return pubsub.asyncIterator("NEW_MESSAGE");
        },
        ({ newMessage }, _, { user }) => {
          if (newMessage.to === user.user.email) {
            return true;
          }

          return false;
        }
      ),
    },
  },
};
