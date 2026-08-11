const year = document.querySelector("[data-year]");
const calendar = document.querySelector("[data-calendar]");
const calendarFrame = document.querySelector("[data-calendar-frame]");
const loadingMessage = document.querySelector("[data-loading-message]");

if (year) {
  year.textContent = new Date().getFullYear();
}

if (calendar && calendarFrame) {
  const mobileCalendarView = window.matchMedia("(max-width: 42rem)");
  const calendarBaseUrl = calendar.getAttribute("src");

  const updateCalendarView = () => {
    if (!calendarBaseUrl) {
      return;
    }

    const calendarUrl = new URL(calendarBaseUrl, window.location.href);
    const view = mobileCalendarView.matches ? "AGENDA" : "MONTH";
    calendarUrl.searchParams.set("mode", view);

    if (calendar.src === calendarUrl.href) {
      return;
    }

    calendarFrame.classList.remove("is-loaded");

    if (loadingMessage) {
      loadingMessage.textContent = mobileCalendarView.matches
        ? "Loading the mobile event list…"
        : "Loading the calendar…";
    }

    calendar.src = calendarUrl.href;
  };

  calendar.addEventListener("load", () => {
    calendarFrame.classList.add("is-loaded");

    if (loadingMessage) {
      loadingMessage.textContent = "Calendar loaded.";
    }
  });

  updateCalendarView();
  mobileCalendarView.addEventListener("change", updateCalendarView);
}
