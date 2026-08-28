const REASONS = {
  "oauth-pending":
    "GitHub sign-in is not open on this site yet. The login route is ready. It waits for the App client secret.",
  denied: "GitHub did not authorize this site. You can try again when you want to.",
  state: "The sign-in session expired or did not match. Start again from this page.",
  exchange: "GitHub did not return an access token. Start again from this page.",
  user: "GitHub did not return an account. Start again from this page.",
};

function boot() {
  const params = new URLSearchParams(location.search);
  const reason = params.get("reason");
  const next = params.get("next") || "/account/";
  const box = document.getElementById("signin-reason");
  const start = document.getElementById("signin-start");
  if (box && REASONS[reason]) {
    box.hidden = false;
    box.querySelector("p").textContent = REASONS[reason];
  }
  if (start) {
    start.href = `/auth/login?next=${encodeURIComponent(next)}`;
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
