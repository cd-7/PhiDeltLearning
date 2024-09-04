const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.database();
const runtimeConfig = functions.config();

const cors = require("cors");
const cors2 = require("cors")({ origin: true });

const bodyParser = require("body-parser");
const OpenAI = require("openai");
const express = require("express");

const openai = new OpenAI({
  apiKey: runtimeConfig.openai.apikey,
  organization: runtimeConfig.openai.organization,
});

const app = express();

app.use(bodyParser.json());
app.use(cors({ origin: true }));

app.post("/", async (req, res) => {
  try {
    const code = req.body.code;
    if (code !== "truth") return res.status(400).send();
    const message = req.body.message;
    const email = req.body.email;
    const newChat = req.body.new;
    const chatID = req.body.chatID;
    let conversationCount;
    const userRef = db.ref("users/" + sanitizeEmail(email));

    userRef
      .once("value", (snapshot) => {
        if (!snapshot.exists()) {
          console.error("User doesn't exist");
          return res.status(400).send();
        }
      })
      .catch(() => {
        console.error("User doesn't exist");
        return res.status(400).send();
      });

    let messages = [];
    messages.push({
      role: "system",
      content:
        "You are a helpful assistant. You have the capability to use LaTeX for formatting and displaying mathematical formulas. Please use LaTeX syntax when presenting mathematical or scientific expressions. You are also capable of using Markdown for text formatting. Please utilize Markdown syntax for formatting text, such as for headings, lists, links, and emphasis. IT IS IMPERATIVE THAT YOU BE BREIF AND SUMMARIZE OFTEN. GIVE ONLY THE MINIMAL AMOUNT OF INFORMATION.",
    });

    if (!newChat) {
      const snapshot = await new Promise((resolve, reject) => {
        userRef.child("conversation" + chatID).once("value", resolve, reject);
      });

      const data = snapshot.val();
      if (data) {
        for (let i = data.queryCount; i >= 1 && i > data.queryCount - 1; i--) {
          let query = data["query" + i];
          if (query) {
            messages.push({ role: "user", content: query["req"] });
            messages.push({ role: "assistant", content: query["res"] });
          }
        }
      }
    }
    messages.push({ role: "user", content: message });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-2024-08-06",
      messages: messages,
    });
    let answer = completion.choices[0].message.content;

    userRef.update({ lastUse: Date.now() });

    const convoCountRef = db.ref(
      `users/${sanitizeEmail(email)}/conversationCount`
    );

    if (newChat) {
      convoCountRef
        .once("value")
        .then((convoSnapshot) => {
          conversationCount = convoSnapshot.val() + 1;
          const convoRef = userRef.child("conversation" + conversationCount);
          convoRef.update({
            queryCount: 1,
            query1: {
              req: message,
              res: answer,
            },
          });
          userRef.update({ conversationCount: conversationCount });
          if (conversationCount > 15) {
            const titleRef = userRef
              .child("titles")
              .child("title" + (conversationCount - 15));
            titleRef.remove();
          }
        })
        .catch((error) => {
          console.error("Error fetching conversation count:", error);
          return res.status(400).send();
        });
    } else {
      const convoRef = userRef.child("conversation" + chatID);
      convoRef
        .child("queryCount")
        .once("value")
        .then((querySnapshot) => {
          const queryCount = querySnapshot.val() + 1;
          let queryObject = {};
          queryObject["query" + queryCount] = { req: message, res: answer };
          let propertyName = Object.keys(queryObject)[0];
          let propertyValue = queryObject[propertyName];
          convoRef.update({
            queryCount: queryCount,
            [propertyName]: propertyValue,
          });
        })
        .catch((error) => {
          console.error("Error fetching query count:", error);
          return res.status(400).send();
        });
    }
    const completionTitle = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content:
            "Give a simple and straightforward title for this prompt and ensure it's less than 10 words: " +
            message.substring(0, 150),
        },
      ],
    });

    if (newChat) {
      let title = completionTitle.choices[0].message.content;
      const titleObject = {};
      titleObject["title" + conversationCount] = title;
      let propertyName = Object.keys(titleObject)[0];
      let propertyValue = titleObject[propertyName];
      userRef.child("titles").update({
        [propertyName]: propertyValue,
      });
      return res
        .status(200)
        .json({ answer: answer, chatID: conversationCount });
    } else {
      return res.status(200).json({ answer: answer, chatID: chatID });
    }
  } catch (error) {
    console.error(error);
    return res.status(400).send();
  }
});

exports.ask = functions.https.onRequest(app);

exports.loadPrev = functions.https.onRequest((req, res) => {
  cors2(req, res, async () => {
    try {
      const code = req.body.code;
      if (code !== "truth") return res.status(400).send();
      const email = req.body.email;
      if (!email) return res.status(400).send();

      const titleRef = db.ref("users/" + sanitizeEmail(email) + "/titles");

      const titleSnapshot = await new Promise((resolve, reject) => {
        titleRef.once("value", resolve, reject);
      });
      const titleData = titleSnapshot.val();

      const convoCountRef = db.ref(
        `users/${sanitizeEmail(email)}/conversationCount`
      );
      const countSnapshot = await new Promise((resolve, reject) => {
        convoCountRef.once("value", resolve, reject);
      });
      const countData = countSnapshot.val();

      return res.status(200).json({ titles: titleData, count: countData });
    } catch (e) {
      console.error(e);
      return res.status(400).send();
    }
  });
});

exports.loadChat = functions.https.onRequest((req, res) => {
  cors2(req, res, async () => {
    try {
      const code = req.body.code;
      if (code !== "truth") return res.status(400).send();

      const email = req.body.email;
      const chatID = req.body.chatID;
      if (!email || !chatID) return res.status(400).send();

      const convoRef = db.ref(
        "users/" + sanitizeEmail(email) + "/conversation" + chatID
      );

      const snapshot = await new Promise((resolve, reject) => {
        convoRef.once("value", resolve, reject);
      });
      const data = snapshot.val();
      return res.status(200).json({ chat: data });
    } catch {
      return res.status(400).send();
    }
  });
});

exports.login = functions.https.onRequest((req, res) => {
  cors2(req, res, async () => {
    try {
      let email = req.body.email;
      const password = req.body.password;
      if (email && password && password == "truth") {
        if (!isValidEmail(email)) return res.status(400).send();
        email = sanitizeEmail(email);
      } else return res.status(400).send();

      const userRef = db.ref("users").child(email);
      const userSnapshot = await userRef.once("value");
      const userData = userSnapshot.val();

      if (!userData) {
        await userRef.update({
          conversationCount: 0,
          lastUse: Date.now(),
        });
      }

      const emailRef = db.ref("emails");

      emailRef.child(email).once("value", (snapshot) => {
        if (!snapshot.exists()) {
          const emailObject = {};
          emailObject[email] = true;
          let propertyName = Object.keys(emailObject)[0];
          let propertyValue = emailObject[propertyName];
          emailRef.update({
            [propertyName]: propertyValue,
          });
        }
      });
      return res.status(200).send();
    } catch (e) {
      console.error(e);
      return res.status(400).send();
    }
  });
});

function sanitizeEmail(email) {
  return email.replace(/\./g, ",");
}

function isValidEmail(email) {
  var regex =
    /^(([^<>()\[\]\\.,;:\s@\"]+(\.[^<>()\[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return regex.test(email);
}
