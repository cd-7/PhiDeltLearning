localStorage.removeItem("chatID");
document.querySelector("nav").style.display = "none";
document.querySelector(".container").style.display = "none";

let email = localStorage.getItem("email");
let code = localStorage.getItem("code");

if (email && code) {
  checkLogin(email, code);
} else {
  window.location.href = "/client/index.html";
}

const params = new URLSearchParams(window.location.search);
const chatQuery = params.get("chat");
async function loadChat() {
  let email = localStorage.getItem("email");
  if (email === "") return;
  try {
    const response = await fetch(
      "https://us-central1-phideltlearning.cloudfunctions.net/loadChat",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          chatID: chatQuery,
        }),
      }
    );
    const data = await response.json();

    for (let i = 1; i <= data.chat.queryCount; i++) {
      const query = data.chat["query" + i];
      document.getElementById("messages").innerHTML +=
        `<div class="msg--sent"><p>` +
        query.req +
        `</p>
    </div>`;
      document.getElementById("messages").innerHTML +=
        "<div class='msg--recieved'><p>" + query.res + "</p></div>";
    }
    console.log(data);
  } catch {
    window.location.href = "/client/chat.html";
  }
}

async function loadPrev() {
  let email = localStorage.getItem("email");
  if (email === "") return;
  try {
    const response = await fetch(
      "https://us-central1-phideltlearning.cloudfunctions.net/loadPrev",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
        }),
      }
    );
    const data = await response.json();
    document.getElementById("prev").innerHTML = "";
    for (let i = 1; i <= data.count; i++) {
      document.getElementById("prev").innerHTML =
        `<a href="?chat=` +
        i +
        `">` +
        data.titles["title" + i] +
        `</a>` +
        document.getElementById("prev").innerHTML;
    }
  } catch {}
}

window.onload = () => {
  if (chatQuery) loadChat();
  loadPrev();
};

let messageCount = 0;

document.getElementById("send").addEventListener("click", message);

let index = 0;
let answer = "";
function typeWriter() {
  if (index < answer.length) {
    document.getElementById("message" + messageCount).innerHTML +=
      answer.charAt(index);
    index++;
    setTimeout(typeWriter, Math.floor(Math.random() * (30 - 1 + 1)) + 1);
  } else {
    index = 0;
    messageCount++;
    answer = "";
    loadPrev();
  }
}

async function message() {
  const message = document.getElementById("input").value;
  document.getElementById("input").value = "";
  if (message == "") return;
  document.getElementById("messages").innerHTML +=
    `<div class="msg--sent"><p>` +
    message +
    `</p>
    </div>`;
  const reply = await ask(message);
  document.getElementById("messages").innerHTML +=
    `<div class="msg--recieved"><p id="message` +
    messageCount +
    `"></p>
    </div>`;
  localStorage.setItem("chatID", reply.chatID);
  answer = reply.answer;
  typeWriter();
}

async function ask(gptMessage) {
  let email = localStorage.getItem("email");
  if (email === "") return;

  let newChat = document.getElementById("messages").childElementCount === 1;
  let chatID;
  if (chatQuery) {
    chatID = chatQuery;
  } else {
    chatID = localStorage.getItem("chatID");
    if (chatID) {
      chatID = parseInt(chatID);
      console.log(chatID);
    } else {
      chatID = -1;
    }
  }
  const response = await fetch(
    "https://us-central1-phideltlearning.cloudfunctions.net/ask",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: gptMessage,
        email: email,
        new: newChat,
        chatID: chatID,
      }),
    }
  );
  const data = await response.json();
  return data;
}

async function checkLogin(email, password) {
  try {
    const response = await fetch(
      "https://us-central1-phideltlearning.cloudfunctions.net/login",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          password: password,
        }),
      }
    );
    if (response.status === 200) {
      document.getElementById("load").style.display = "none";
      document.querySelector("nav").style.display = "flex";
      document.querySelector(".container").style.display = "grid";
    } else if (response.status === 400) {
      window.location.href = "/client/index.html";
    }
  } catch (error) {
    console.log("Error:", error.message);
  }
}
