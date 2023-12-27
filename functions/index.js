const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.database();
const runtimeConfig = functions.config();

const cors = require("cors");

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
    const message = req.body.message;

    const convoRef = db.ref("attempts").child(extensionId);
    const convoSnapshot = await attemptsRef.once("value");
    const convoData = attemptsSnapshot.val();

    messages = [];

    const completion = await openai.chat.completions.create({
      model: "gpt-4-1106-preview",
      messages: [{ role: "user", content: `${message}` }],
    });
    let answer = completion.choices[0].message.content;

    await attemptsRef.update({});

    return res.status(200).json({ answer: answer });
  } catch (error) {
    return res.status(400);
  }
});

exports.ask = functions.https.onRequest(app);
