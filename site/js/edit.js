function params() {
  const search = new URLSearchParams(location.search);
  return {
    fragment: search.get("fragment") || "1QIsa-a-40-3-sample",
    token: search.get("token") || "0",
    mss: search.get("mss") || "1Qisaa",
    line: search.get("line") || "",
    current: search.get("current") || "",
  };
}

function setReason(id, message) {
  const node = document.getElementById(id);
  if (node) node.textContent = message;
}

function ensureDeskStore() {
  if (window.odsDesk) return Promise.resolve(window.odsDesk);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/js/desk-store.js";
    script.onload = () => resolve(window.odsDesk);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

let bound = false;
let latest = {
  configured: false,
  capabilities: { suggest: false },
  user: null,
};

document.addEventListener("ods:session", (event) => {
  latest = event.detail;
  const form = document.getElementById("edit-form");
  const query = params();
  const fragmentField = document.getElementById("fragment-id");
  const tokenField = document.getElementById("token-index");
  if (fragmentField) fragmentField.value = query.fragment;
  if (tokenField) tokenField.value = query.token;
  const current = document.querySelector(".lex-head");
  if (current && query.current) current.textContent = query.current;

  if (!form || bound) return;
  bound = true;
  form.addEventListener("submit", (submitEvent) => {
    submitEvent.preventDefault();
    const reason = document.getElementById("reason");
    const reading = document.getElementById("reading");
    if (reason) reason.closest(".field").classList.remove("is-error");
    if (!latest.capabilities.suggest || !latest.user) {
      setReason("form-status", "Sign in with GitHub to suggest a translation.");
      return;
    }
    if (!reading || !reading.value.trim()) {
      setReason("form-status", "Enter your suggested translation.");
      return;
    }
    ensureDeskStore()
      .then((api) => api.load().then(() => api))
      .then((api) =>
        api.addProposal(latest.user, {
          mss_id: query.mss,
          mss_label: query.mss,
          line_ref: query.line,
          current_form: query.current || (document.querySelector(".lex-head") || {}).textContent || "",
          proposed_form: reading.value.trim(),
          reason: reason.value.trim(),
        }),
      )
      .then((rec) => {
        location.href = "/proposal/?id=" + encodeURIComponent(rec.id);
      })
      .catch((error) => {
        setReason("form-status", error.message || "The suggestion could not be saved. Please try again.");
      });
  });
});
