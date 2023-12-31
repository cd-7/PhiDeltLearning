document.getElementById("submit").addEventListener("click", submit);

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
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  if (email === "" || password === "") {
    console.log("Email or password is empty");
    return;
  }
  login(email, password);
}

async function login(email, password) {
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

    console.log("Response:", response);

    // Directly check the response status
    if (response.status === 200) {
      console.log("Login successful");
      localStorage.setItem("email", email);
      localStorage.setItem("code", password);
      window.location.href = "/client/chat.html";
    } else if (response.status === 400) {
      console.log("Login failed");
    }
  } catch (error) {
    console.log("Error:", error.message);
  }
}
