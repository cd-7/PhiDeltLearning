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

async function loadChat() {
  document.getElementById("messages").innerHTML = "";
  const params = new URLSearchParams(window.location.search);
  const chatQuery = params.get("chat");
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
          code: code,
          chatID: chatQuery,
        }),
      }
    );
    const data = await response.json();

    for (let i = 1; i <= data.chat.queryCount; i++) {
      const query = data.chat["query" + i];
      document.getElementById("messages").innerHTML +=
        `<div class="msg--sent">` + query.req + `</div>`;
      document.getElementById("messages").innerHTML +=
        "<div class='msg--recieved'>" + markdownToHTML(query.res) + "</div>";
    }
    updateMathJax();
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
          code: code,
          email: email,
        }),
      }
    );

    const data = await response.json();
    const prev = document.getElementById("prev");
    prev.innerHTML = "";

    for (let i = data.count; i >= 1 && i > data.count - 15; i--) {
      prev.innerHTML += `<div data-id="${i}">${data.titles["title" + i]}</div>`;
    }

    var children = Array.prototype.slice.call(prev.children);
    children.forEach(function (child) {
      child.addEventListener("click", function () {
        let currentUrl = window.location.href;
        let newUrl = new URL(currentUrl);
        newUrl.searchParams.set("chat", child.dataset.id);
        window.history.pushState({ path: newUrl.href }, "", newUrl.href);
        loadChat();
      });
    });
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

window.onload = () => {
  const params = new URLSearchParams(window.location.search);
  const chatQuery = params.get("chat");
  if (chatQuery) {
    loadChat();
  }
  loadPrev();
};

document.getElementById("send").addEventListener("click", message);

let index = 0;
let answer = "";
function typeWriter() {
  if (index < answer.length) {
    document.getElementById(
      "message" + document.querySelectorAll(".msg--sent").length
    ).innerHTML += answer.charAt(index);
    index++;
    setTimeout(typeWriter, Math.floor(Math.random() * 10) + 1);
  } else {
    index = 0;
    document.getElementById(
      "message" + document.querySelectorAll(".msg--sent").length
    ).innerHTML = answer;
    answer = "";
    document.getElementById("send").disabled = false;
    updateMathJax();
  }
}

async function message() {
  const message = document.getElementById("input").value;
  document.getElementById("input").value = "";
  document.getElementById("send").disabled = true;
  if (message == "") return;
  document.getElementById("messages").innerHTML +=
    `<div class="msg--sent">` + message + `</div>`;
  document.getElementById("messages").innerHTML += `<span id="dots"></span>`;

  const reply = await ask(message);
  document.getElementById("dots").remove();

  document.getElementById("messages").innerHTML +=
    `<div id="message` +
    document.querySelectorAll(".msg--sent").length +
    `" class="msg--recieved"></div>`;
  localStorage.setItem("chatID", reply.chatID);
  answer = markdownToHTML(reply.answer);
  loadPrev();
  typeWriter();
}

async function ask(gptMessage) {
  let email = localStorage.getItem("email");
  if (email === "") return;

  const params = new URLSearchParams(window.location.search);
  const chatQuery = params.get("chat");

  let newChat = document.getElementById("messages").childElementCount === 2;
  let chatID;
  if (chatQuery) {
    chatID = chatQuery;
  } else {
    chatID = localStorage.getItem("chatID");
    if (chatID) {
      chatID = parseInt(chatID);
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
        code: code,
        new: newChat,
        chatID: chatID,
      }),
    }
  );
  const data = await response.json();

  let currentUrl = window.location.href;
  let newUrl = new URL(currentUrl);
  newUrl.searchParams.set("chat", data.chatID);
  window.history.pushState({ path: newUrl.href }, "", newUrl.href);

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

function markdownToHTML(markdown) {
  // Convert headers
  markdown = markdown.replace(/^### (.*$)/gim, "<strong>$1</strong>");
  markdown = markdown.replace(/^## (.*$)/gim, "<strong>$1</strong>");
  markdown = markdown.replace(/^# (.*$)/gim, "<strong>$1</strong>");
  // Convert bold text
  markdown = markdown.replace(/\*\*(.*)\*\*/gim, "<strong>$1</strong>");

  // Convert italic text
  markdown = markdown.replace(/\*(.*)\*/gim, "<em>$1</em>");

  // Convert blockquotes
  markdown = markdown.replace(/^\> (.*$)/gim, "<blockquote>$1</blockquote>");

  // Convert code blocks
  markdown = markdown.replace(
    /```([\s\S]*?)```/gim,
    "<pre><code>$1</code></pre>"
  );

  // Convert inline code
  markdown = markdown.replace(/`(.+?)`/gim, "<code>$1</code>");

  // Convert unordered lists
  markdown = markdown.replace(/^\s*[-\*+] (.+)$/gim, "<li>$1</li>");
  markdown = markdown.replace(/(<li>.*<\/li>)/gim, "<ul>$1</ul>");
  markdown = markdown.replace(/<\/ul>\s*<ul>/gim, ""); // Fixes consecutive list items issue

  // Convert newlines to <br>
  markdown = markdown.replace(/\n$/gim, " <br /><br />");

  return markdown.trim();
}

// Assuming you load your content and then call this function
function updateMathJax() {
  if (window.MathJax) {
    MathJax.typesetPromise([document.getElementById("messages")]);
  }
}

function adjustVH() {
  let vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty("--vh", `${vh}px`);
}

window.addEventListener("resize", adjustVH);
adjustVH();
