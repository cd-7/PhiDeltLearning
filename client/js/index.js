const submitButton = document.getElementById("submit");
submitButton.addEventListener("click", submit);

let email = localStorage.getItem("email");
let code = localStorage.getItem("code");

if (email && code) {
  login(email, code);
} else {
  document.querySelector(".loader").style.display = "none";
  document.querySelector("form").style.display = "grid";
}

async function submit(event) {
  event.preventDefault();
  submitButton.disabled = true;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  if (email === "" || password === "") {
    console.log("Email or password is empty");
    return;
  }
  login(email, password);
}

async function login(email, password) {
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

  // Directly check the response status
  if (response.status === 200) {
    console.log("Login successful");
    localStorage.setItem("email", email);
    localStorage.setItem("code", password);
    window.location.href = "/client/chat.html";
  } else if (response.status === 400) {
    localStorage.removeItem("email");
    localStorage.removeItem("code");
    document.querySelector(".loader").style.display = "none";
    document.querySelector("form").style.display = "grid";
    document.getElementById("error").style.display = "initial";
    submitButton.disabled = false;
  }
}
