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

const installButtons = document.querySelectorAll("[data-install-button]");
const installDialog = document.querySelector("[data-install-dialog]");
const installInstructions = document.querySelector("[data-install-instructions]");
const isInstalled = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent);
let deferredInstallPrompt = null;

const showInstallButtons = () => {
  if (!isInstalled) {
    installButtons.forEach((button) => { button.hidden = false; });
  }
};

const showInstallInstructions = () => {
  if (!installDialog || !installInstructions) return;
  const isAndroid = /Android/i.test(window.navigator.userAgent);
  installInstructions.innerHTML = isAndroid
    ? "<li>Open your browser menu using the <strong>three dots</strong>.</li><li>Choose <strong>Add to Home screen</strong> or <strong>Install app</strong>.</li><li>Tap <strong>Install</strong>.</li>"
    : "<li>Tap the <strong>Share</strong> button in Safari.</li><li>Choose <strong>Add to Home Screen</strong>.</li><li>Turn on <strong>Open as Web App</strong>, then tap <strong>Add</strong>.</li>";
  if (typeof installDialog.showModal === "function") installDialog.showModal();
  else installDialog.setAttribute("open", "");
};

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  showInstallButtons();
});

installButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    if (deferredInstallPrompt) {
      await deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      if (choice.outcome === "accepted") installButtons.forEach((installButton) => { installButton.hidden = true; });
      return;
    }
    showInstallInstructions();
  });
});

if (isMobileDevice && !isInstalled) showInstallButtons();

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  installButtons.forEach((button) => { button.hidden = true; });
});

const shareButtons = document.querySelectorAll("[data-share-button]");
const shareFeedback = document.querySelector("[data-share-feedback]");

shareButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const isTangoPage = window.location.pathname.endsWith("/tango.html");
    const shareData = {
      title: isTangoPage ? "CATS Tango Events | Dance Charleston" : "Dance Charleston | Local Dance Calendar",
      text: isTangoPage ? "See upcoming Charleston Argentine Tango events." : "Find upcoming dance events across the Charleston Lowcountry.",
      url: window.location.href.split("#")[0],
    };

    try {
      if (typeof window.navigator.share === "function") {
        await window.navigator.share(shareData);
      } else {
        await window.navigator.clipboard.writeText(shareData.url);
        if (shareFeedback) shareFeedback.textContent = "Link copied — ready to share.";
      }
    } catch (error) {
      if (error?.name !== "AbortError" && shareFeedback) {
        shareFeedback.textContent = "Use your browser’s Share menu to send this page.";
      }
    }
  });
});

if ("serviceWorker" in window.navigator) {
  window.addEventListener("load", () => {
    window.navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
