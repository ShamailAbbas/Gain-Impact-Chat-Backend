const bcrypt = require("bcryptjs");
const { UserInputError, AuthenticationError } = require("apollo-server");
const jwt = require("jsonwebtoken");
const User = require("../../models/user");

const Message = require("../../models/message");

module.exports = {
  Query: {
    getUsers: async (_, __, context) => {
      const user = context.user.user;
      try {
        if (!user) throw new AuthenticationError("Unauthenticated");

        const pipelineoforuser = [
          {
            $match: { email: { $ne: user.email } },
          },
          {
            $project: {
              _id: 0,
              email: 1,
              createdAt: 1,
              username: 1,
              name: 1,
            },
          },
        ];
        const users = await User.aggregate(pipelineoforuser);

        const getuserwithmessage = async (users) => {
          let userwithmsg = [];
          for (let i = 0; i < users.length; i++) {
            let singleuser = users[i];
            const currentuser = [user.email, singleuser.email];
            var pipeline = [
              {
                $match: {
                  to: { $in: currentuser },
                },
              },
              {
                $match: {
                  from: { $in: currentuser },
                },
              },

              {
                $project: {
                  _id: 0,
                  content: 1,
                  createdAt: 1,
                },
              },
              {
                $sort: {
                  createdAt: -1,
                },
              },

              {
                $limit: 1,
              },
            ];

            const latestMessage = await Message.aggregate(pipeline);

            singleuser = {
              ...singleuser,
              latestMessage: {
                content: latestMessage[0]?.content,
                createdAt: latestMessage[0]?.createdAt.toISOString(),
              },
            };
            userwithmsg.push(singleuser);
          }

          return userwithmsg;
        };
        const usrwithlastmsg = await getuserwithmessage(users);

        return usrwithlastmsg;
      } catch (err) {
        console.log(err);
        throw err;
      }
    },
    login: async (_, args) => {
      const { username, password } = args;
      let errors = {};

      try {
        if (username.trim() === "")
          errors.username = "username must not be empty";
        if (password === "") errors.password = "password must not be empty";

        if (Object.keys(errors).length > 0) {
          throw new UserInputError("bad input", { errors });
        }

        const user = await User.findOne({
          username,
        });
        console.log;
        if (!user) {
          errors.username = "username incorrect";
          throw new UserInputError("user not found", { errors });
        }

        const correctPassword = await bcrypt.compare(password, user.password);

        if (!correctPassword) {
          errors.password = "password is incorrect";
          throw new UserInputError("password is incorrect", { errors });
        }

        const token = jwt.sign({ user }, process.env.JWT_SECRET, {
          expiresIn: "10d",
        });

        return {
          ...user.toJSON(),
          token,
        };
      } catch (err) {
        console.log(err);
        throw err;
      }
    },
  },
  Mutation: {
    register: async (_, args) => {
      let { name, username, email, password, confirmPassword } = args;
      let errors = {};

      try {
        if (name.trim() === "") errors.name = "name must not be empty";
        if (username.trim() === "")
          errors.username = "username must not be empty";
        if (email.trim() === "") errors.email = "email must not be empty";
        if (password.trim() === "")
          errors.password = "password must not be empty";
        if (confirmPassword.trim() === "")
          errors.confirmPassword = "repeat password must not be empty";

        if (password !== confirmPassword)
          errors.confirmPassword = "passwords must match";

        const usernametaken = await User.findOne({ username });
        console.log(usernametaken);
        if (usernametaken) errors.username = "username already taken";
        const emailtaken = await User.findOne({ email });

        console.log(emailtaken);
        if (emailtaken) errors.email = "email already taken";

        if (Object.keys(errors).length > 0) {
          console.log(errors);
          throw new UserInputError("user not found", { errors });
        }

        const hashedpassword = await bcrypt.hash(password, 10);
        const newuser = new User({
          name,
          username,
          email,
          password: hashedpassword,
        });
        const savenewuser = await newuser.save();
        if (savenewuser)
          return {
            success: true,
          };
        else
          return {
            success: false,
          };
      } catch (err) {
        console.log("errer is", err);
        throw err;
      }
    },
  },
};
