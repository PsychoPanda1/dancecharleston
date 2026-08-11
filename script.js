const year = document.querySelector("[data-year]");
const calendar = document.querySelector("[data-calendar]");
const calendarFrame = document.querySelector("[data-calendar-frame]");
const loadingMessage = document.querySelector("[data-loading-message]");

if (year) {
  year.textContent = new Date().getFullYear();
}

if (calendar && calendarFrame) {
  calendar.addEventListener("load", () => {
    calendarFrame.classList.add("is-loaded");

    if (loadingMessage) {
      loadingMessage.textContent = "Calendar loaded.";
    }
  });
}
