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
  }
}

async function message() {
  const message = document.getElementById("input").value;
  console.log(message);
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
  answer = reply.answer;
  console.log(answer);
  typeWriter();
}

async function ask(gptMessage) {
  const response = await fetch(
    "https://us-central1-phideltlearning.cloudfunctions.net/ask",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: gptMessage,
      }),
    }
  );
  const data = await response.json();
  return data;
}
