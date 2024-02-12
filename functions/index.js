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
          return res.status(400).send();
        }
      })
      .catch((error) => {
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

    console.log(messages);
    const completion = await openai.chat.completions.create({
      model: "gpt-4-1106-preview",
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
            const oldRef = userRef.child(
              "conversation" + (conversationCount - 15)
            );
            const titleRef = userRef
              .child("titles")
              .child("title" + (conversationCount - 15));
            titleRef.remove();
            oldRef.remove();
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
      model: "gpt-3.5-turbo-1106",
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

exports.checkLastUses = functions.https.onRequest((req, res) => {
  cors2(req, res, async () => {
    try {
      const emailRef = db.ref("emails");
      emailRef.once("value", (emailSnapshot) => {
        const emails = Object.keys(emailSnapshot.val());
        emails.forEach((email) => {
          if (email) {
            const lastUse = db.ref(`users/` + email + `/lastUse`);
            lastUse.once("value", (useSnapshot) => {
              const date = useSnapshot.val();
              let currentTimestampMillis = Date.now();
              let oneWeekAgoMillis =
                currentTimestampMillis - 1 * 7 * 24 * 60 * 60 * 1000;
              if (
                date &&
                date < oneWeekAgoMillis &&
                email &&
                email.trim() != ""
              ) {
                db.ref("users").child(email).remove();
                emailRef.child(email).remove();
              }
            });
          }
        });
      });
      return res.status(200).send();
    } catch {
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

exports.addSchedulePeriod = functions.https.onRequest((req, res) => {
  cors2(req, res, async () => {
    const { email, startTime, endTime } = req.body;

    // Check if email, startTime, and endTime are provided
    if (!email || !startTime || !endTime) {
      res
        .status(400)
        .json({ message: "Email, start time, and end time are required." });
      return;
    }

    // Parse dates and check validity
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json({ message: "Invalid start time or end time." });
      return;
    }

    const schedulesRef = db.ref(`schedule`);
    const schedulesSnapshot = await schedulesRef.once("value");
    const allSchedules = schedulesSnapshot.val() || {};

    // Check if the user already has a schedule
    const sanitizedEmail = sanitizeEmail(email);
    if (allSchedules[sanitizedEmail]) {
      res.status(400).json({
        message:
          "User already has a schedule. Please remove the old schedule before adding a new one.",
      });
      return;
    }

    // Check for conflicting schedules across all emails
    for (const emailKey in allSchedules) {
      const userSchedule = allSchedules[emailKey];
      if (userSchedule) {
        const existingStart = new Date(userSchedule.start);
        const existingEnd = new Date(userSchedule.end);
        if (start < existingEnd && end > existingStart) {
          res.status(400).json({
            message: "Conflicting schedule exists with another user.",
          });
          return;
        }
      }
    }

    // Set the new schedule period for the specified email
    const userScheduleRef = schedulesRef.child(sanitizedEmail);
    await userScheduleRef.set({ start: startTime, end: endTime });

    res.status(200).json({ message: "Schedule added successfully." });
  });
});

exports.getSchedule = functions.https.onRequest((req, res) => {
  cors2(req, res, async () => {
    try {
      const now = new Date().toISOString();

      const schedulesRef = db.ref(`schedule`);
      const snapshot = await schedulesRef.once("value");

      if (snapshot.exists()) {
        const schedules = snapshot.val() || {};
        let hasOldSchedules = false;

        for (const email in schedules) {
          const schedule = schedules[email];

          const scheduleEndTime = new Date(schedule.end);

          if (scheduleEndTime < new Date(now)) {
            await schedulesRef.child(email).remove();
            hasOldSchedules = true;
          }
        }

        if (hasOldSchedules) {
          const updatedSnapshot = await schedulesRef.once("value");
          res.status(200).json(updatedSnapshot.val() || {});
        } else {
          res.status(200).json(schedules);
        }
      } else {
        res.status(200).json({});
      }
    } catch (error) {
      console.error("Error getting schedules: ", error);
      res.status(500).send("Internal Server Error");
    }
  });
});

exports.removeSchedulePeriod = functions.https.onRequest((req, res) => {
  cors2(req, res, async () => {
    try {
      const { email } = req.body;
      if (!email) {
        res.status(400).send("Email is required.");
        return;
      }

      // Reference to the user's schedule in the database
      const scheduleRef = db.ref(`schedule/${sanitizeEmail(email)}`);

      // Remove the schedule
      await scheduleRef.remove();

      res.status(200).send("Schedule removed successfully.");
    } catch (error) {
      console.error("Error removing schedule: ", error);
      res.status(500).send("Internal Server Error");
    }
  });
});
