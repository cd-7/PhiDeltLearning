let email = localStorage.getItem("email");
let code = localStorage.getItem("code");

if (email && code) {
  checkLogin(email, code);
} else {
  window.location.href = "/client/index.html";
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
    if (response.status === 400) {
      window.location.href = "/client/index.html";
    }
  } catch (error) {
    console.log("Error:", error.message);
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const scheduleForm = document.getElementById("scheduleForm");
  const startTimeInput = document.getElementById("startTime");
  const endTimeInput = document.getElementById("endTime");
  const scheduleList = document.getElementById("scheduleList");

  // Function to fetch schedules
  async function fetchSchedules() {
    try {
      const response = await fetch(
        "https://us-central1-phideltlearning.cloudfunctions.net/getSchedule"
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const schedules = await response.json();
      renderSchedule(schedules);
      document.getElementById("load").style.display = "none";
      document.querySelector(".schedule-container").style.display = "block";
    } catch (error) {
      console.error("Error fetching schedules:", error);
    }
  }

  // Fetch schedules when the page loads
  fetchSchedules();

  // Set endTime to startTime when startTime is changed
  startTimeInput.addEventListener("change", function () {
    endTimeInput.value = startTimeInput.value;
  });

  scheduleForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const startTime = new Date(startTimeInput.value).toISOString();
    const endTime = new Date(endTimeInput.value).toISOString();
    const now = new Date();
    const twoMinutesAgo = new Date(now.getTime() - 2 * 60000).toISOString();

    if (startTime < twoMinutesAgo) {
      alert("Start time cannot be in the past.");
      return;
    }

    if (startTime >= endTime) {
      alert("End time must be after start time.");
      return;
    }

    if (new Date(endTime).getTime() - new Date(startTime).getTime() > 7200000) {
      alert("The usage period cannot be more than 1 hours.");
      return;
    }

    try {
      const response = await fetch(
        "https://us-central1-phideltlearning.cloudfunctions.net/addSchedulePeriod",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, startTime, endTime }),
        }
      );
      const resMessage = await response.json();
      const message = resMessage.message;
      if (response.ok) {
        // Store the original local time for UI purposes
        localStorage.setItem("cheggStart", startTimeInput.value);
        localStorage.setItem("cheggEnd", endTimeInput.value);
      }
      alert(message);
      await fetchSchedules();
    } catch (error) {
      console.error("Error adding schedule:", error);
    }
  });

  function renderSchedule(schedules) {
    scheduleList.innerHTML = "";
    for (const [userEmail, schedule] of Object.entries(schedules)) {
      const div = document.createElement("div");
      div.classList.add("schedule-entry"); // Add class for potential styling
      div.innerHTML = `<strong>Email:</strong> ${userEmail}<br><strong>Start:</strong> ${formatDateTime(
        schedule.start
      )}, <strong>End:</strong> ${formatDateTime(schedule.end)}`;
      // Add a remove button if the current user's email matches
      if (email.replace(/\./g, ",") === userEmail) {
        const removeBtn = document.createElement("button");
        removeBtn.innerText = "Remove";
        removeBtn.classList.add("remove-btn"); // Add class for potential styling
        removeBtn.onclick = function () {
          removeSchedule(email);
        };
        div.appendChild(removeBtn);
      }

      scheduleList.appendChild(div);
    }
  }

  // Function to handle schedule removal
  async function removeSchedule(email) {
    if (confirm(`Are you sure you want to remove the schedule for ${email}?`)) {
      await fetch(
        "https://us-central1-phideltlearning.cloudfunctions.net/removeSchedulePeriod",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        }
      )
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
        })
        .then(() => {
          fetchSchedules();
          alert("Schedule removed successfully.");
          localStorage.removeItem("cheggStart");
          localStorage.removeItem("cheggEnd");
        })
        .catch((error) => {
          console.error("Error removing schedule:", error);
        });
    }
  }

  function formatDateTime(dateTimeStr) {
    const options = {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    };
    return new Date(dateTimeStr).toLocaleDateString(undefined, options);
  }
});
