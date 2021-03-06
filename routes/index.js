const express = require("express");
const router = express.Router();

const User = require("../model/user");
const passport = require("passport");
const check = require("../helper/validate");
const bcrypt = require("bcryptjs");
require("dotenv/config");
const faker = require("faker");
const fetch = require("node-fetch");

User.createMapping(function (err, mapping) {
  if (err) throw err;
});

router.get("/", (req, res, next) => {
  if (req.user) {
    let userDb = req.user;
    let userId = userDb._id;
    let id = req.query.id;
    if (!id) {
      res.redirect("/?id=" + userId);
    } else {
      User.findById(id, (err, user) => {
        if (err) throw err;

        if (!user) {
          res.redirect("/");
        } else {
          User.findById(userId, (err, mainUser) => {
            if (err) throw err;

            let users = {
              notification: mainUser.notification,
              username: user.username,
              avatar: user.avatar,
              profile_image: user.profile_image,
              intro: user.intro,
              _id: user._id,
              number_friend: user.number_friend,
              friend: user.friend,
            };
            if (userId == id) {
              res.render("index", { users: userDb, role: "owner" });
            } else {
              if (user.get_friend.includes(userId)) {
                res.render("index", { users, role: "sendFriend" });
              } else if (mainUser.get_friend.includes(user._id)) {
                res.render("index", { users, role: "getFriend" });
              } else if (
                mainUser.friend.filter((elem) => elem.id == user._id).length > 0
              ) {
                res.render("index", { users, role: "friend" });
              } else {
                res.render("index", { users, role: "client" });
              }
            }
          });
        }
      });
    }
  } else {
    let id = req.query.id;
    if (!id) {
      res.render("login");
    } else {
      res.redirect("/");
    }
  }
});

router.post("/login", function (req, res, next) {
  if (req.user) {
    res.redirect("/");
  } else {
    passport.authenticate("local", function (err, user, info) {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.redirect("/");
      }
      req.logIn(user, function (err) {
        if (err) {
          return next(err);
        }
        return res.redirect("/");
      });
    })(req, res, next);
  }
});

router.post("/register", (req, res, next) => {
  let {
    firstName,
    lastName,
    email,
    password,
    birthday_day,
    birthday_month,
    birthday_year,
    gender,
  } = req.body;

  let obj = {};

  // obj = check.validate(
  //   firstName,
  //   lastName,
  //   email,
  //   password,
  //   birthday_day,
  //   birthday_month,
  //   birthday_year,
  //   gender
  // );
  // let error = obj.errors;

  let error = [];

  if (error.length > 0) {
    res.redirect("/");
  } else {
    // firstName = obj.first_name;
    // lastName = obj.last_name;
    // email = obj.email;
    // password = obj.password;
    // gender = obj.sex;
    // let birthday = obj.birthday;

    firstName = faker.name.firstName();
    lastName = faker.name.lastName();
    email = faker.internet.email();
    password = "root";
    let gen = faker.random.boolean();

    if (gen) gender = "male";
    else gender = "female";

    let birthday = faker.date.past();
    let avatar = faker.image.avatar();

    User.findOne({ email: email }, async (err, user) => {
      if (err) throw err;

      if (user) {
        req.flash("info", "This email is exist please log in.");
        res.redirect("/");
      } else {
        var salt = await bcrypt.genSalt(+process.env.SALT_FACTOR);
        var hashPassword = await bcrypt.hash(password, salt);
        let profile_image = await fetch(
          "https://dog.ceo/api/breeds/image/random"
        ).then((response) => response.json());

        var newUser = new User({
          first_name: firstName,
          last_name: lastName,
          email,
          password: hashPassword,
          username: firstName + " " + lastName,
          gender,
          birthday,
          avatar,
          profile_image: profile_image.message,
        });

        newUser
          .save()
          .then((value) => {
            res.redirect("/");
          })
          .catch((err) => {
            if (err) throw err;
          });
      }
    });
  }
});

router.get("/logout", function (req, res) {
  req.logout();
  res.redirect("/");
});

router.post("/search", (req, res, next) => {
  let searchString = req.body.search;

  User.search(
    {
      query_string: {
        query: searchString,
      },
    },
    async function (err, results) {
      if (err) throw err;

      let reqUser = results.hits.hits;
      let resLength = reqUser.length;
      let userSearch = [];
      for (let i = 0; i < resLength; i++) {
        let user = await User.findById(reqUser[i]._id);
        userSearch.push(user);
      }

      res.render("search", {
        users: userSearch,
        search: searchString,
        mainUser: req.user,
      });
    }
  );
});

router.post("/add-friend", (req, res, next) => {
  let friendId = req.body.friendId;
  let userDb = req.user;
  let userId = userDb._id;

  if (friendId != userId) {
    User.findById(friendId, (err, user) => {
      if (err) throw err;

      if (!user) res.redirect("/");
      else {
        let friendNotification = `send you a friend request that you haven't responded yet.`;

        User.findById(userId, (err, mainUser) => {
          User.updateOne(
            { _id: friendId },
            {
              $push: {
                get_friend: userId,
                notification: {
                  id: userDb._id,
                  avatar: mainUser.avatar,
                  username: mainUser.username,
                  message: friendNotification,
                },
              },
            },
            (err, raw) => {
              if (err) throw err;

              res.redirect("/?id=" + friendId);
            }
          );
        });
      }
    });
  }
});

router.post("/accept-friend", (req, res, next) => {
  let friendId = req.body.friendId;
  let userDb = req.user;
  let userId = userDb._id;
  let acceptFriendNotification = "accept your friend's request";

  User.findById(friendId, (err, friend) => {
    if (err) throw err;

    if (!friend) res.redirect("/");
    else {
      User.findById(userId, async (err, user) => {
        if (err) throw err;

        if (user.get_friend.includes(friendId)) {
          await User.updateOne(
            { _id: friendId },
            {
              $push: {
                friend: {
                  id: userId,
                  avatar: user.avatar,
                  username: user.username,
                },
                notification: {
                  id: userId,
                  avatar: user.avatar,
                  username: user.username,
                  message: acceptFriendNotification,
                },
              },
              $inc: {
                number_friend: 1,
              },
            }
          );

          User.updateOne(
            { _id: userId },
            {
              $push: {
                friend: {
                  id: friendId,
                  avatar: friend.avatar,
                  username: friend.username,
                },
              },
              $pull: {
                get_friend: friendId,
                notification: { id: friendId },
              },
              $inc: {
                number_friend: 1,
              },
            },
            (err, raw) => {
              if (err) throw err;

              res.redirect("/?id=" + friendId);
            }
          );
        }
      });
    }
  });
});

module.exports = router;
