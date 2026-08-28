const PERSONAS = {
  0: {
    user: null,
    capabilities: { read: true, suggest: false, review: false, maintain: false },
    label: "Reader",
  },
  1: {
    user: {
      id: "preview-1",
      login: "preview-contributor",
      tier: 1,
      reputation: 12,
      academicVerified: false,
    },
    capabilities: { read: true, suggest: true, review: false, maintain: false },
    label: "Contributor",
  },
  2: {
    user: {
      id: "preview-2",
      login: "preview-reviewer",
      tier: 2,
      reputation: 540,
      academicVerified: true,
    },
    capabilities: { read: true, suggest: true, review: true, maintain: false },
    label: "Reviewer",
  },
  3: {
    user: {
      id: "preview-3",
      login: "preview-editor",
      tier: 3,
      reputation: 0,
      academicVerified: true,
    },
    capabilities: { read: true, suggest: true, review: true, maintain: true },
    label: "Editor",
  },
};

const TIER_NAME = {
  0: "Reader",
  1: "Contributor",
  2: "Peer reviewer",
  3: "Editor",
};

function themeFromPreference() {
  if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

function previewKey() {
  return sessionStorage.getItem("ods.previewPersona");
}

function ensureCommunityNav() {
  const nav = document.querySelector("header .nav");
  if (!nav || nav.querySelector("[data-nav='community']")) return;
  const work = nav.querySelector("[data-nav='work']");
  const a = document.createElement("a");
  a.href = "/community/";
  a.setAttribute("data-nav", "community");
  a.textContent = "Community";
  if (work && work.nextSibling) nav.insertBefore(a, work.nextSibling);
  else if (work) work.after(a);
  else nav.appendChild(a);
}

function ensureDeskNav(signedIn) {
  const nav = document.querySelector("header .nav");
  if (!nav) return;
  let link = nav.querySelector("[data-nav='account']");
  if (!signedIn) {
    if (link) link.remove();
    return;
  }
  if (link) return;
  link = document.createElement("a");
  link.href = "/account/";
  link.setAttribute("data-nav", "account");
  link.textContent = "Desk";
  const about = nav.querySelector("[data-nav='about']");
  if (about) nav.insertBefore(link, about);
  else nav.appendChild(link);
}

function markNav(signedIn) {
  ensureCommunityNav();
  ensureDeskNav(signedIn);
  const page = document.body.dataset.page;
  if (!page) return;
  document.querySelectorAll("nav [data-nav]").forEach((link) => {
    if (link.getAttribute("data-nav") === page) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function applyCapabilities(state) {
  const cap = state.capabilities || {};
  document.body.dataset.signedIn = state.user ? "1" : "0";
  document.body.dataset.tier = String(state.user ? state.user.tier : 0);
  document.body.dataset.preview = state.preview ? "1" : "0";

  document.querySelectorAll("[data-needs]").forEach((el) => {
    const need = el.dataset.needs;
    el.hidden = !cap[need];
  });
  document.querySelectorAll("[data-needs-missing]").forEach((el) => {
    const need = el.dataset.needsMissing;
    el.hidden = Boolean(cap[need]);
  });
}

function authMarkup(state) {
  if (!state.user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return `<a class="btn btn-secondary" href="/signin/?next=${next}"><svg class="ico" data-i="log-in"></svg>Sign in</a>`;
  }
  const name = TIER_NAME[state.user.tier] || "Contributor";
  return `<a class="who" href="/account/"><span class="who-name">${escapeHtml(state.user.login)}</span><span class="who-tier">${escapeHtml(name)}</span></a>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paintAuth(state) {
  const slot = document.getElementById("auth-slot");
  if (slot) {
    slot.innerHTML = authMarkup(state);
    if (window.odsIcons) window.odsIcons.paint();
  }
}

function removePreviewBar() {
  document.querySelectorAll("[data-preview-bar], .preview-bar").forEach((bar) => bar.remove());
}

async function fetchMe() {
  try {
    const response = await fetch("/api/me", { credentials: "same-origin" });
    if (!response.ok) throw new Error("me");
    return await response.json();
  } catch {
    return {
      configured: false,
      mock: false,
      user: null,
      capabilities: { read: true, suggest: false, review: false, maintain: false },
    };
  }
}

function mergePreview(me) {
  if (me.user) return { ...me, preview: false };
  // Preview personas are a local-development aid. The production API reports
  // mock=false, so an old sessionStorage value can never imitate authority.
  if (!me.mock) return { ...me, preview: false };
  const key = previewKey();
  if (key == null || !PERSONAS[key]) {
    return { ...me, preview: false };
  }
  const persona = PERSONAS[key];
  return {
    ...me,
    user: persona.user,
    capabilities: persona.capabilities,
    preview: true,
  };
}

function setPreview(tier) {
  if (String(tier) === "0" || tier === 0) {
    sessionStorage.removeItem("ods.previewPersona");
    return;
  }
  sessionStorage.setItem("ods.previewPersona", String(tier));
}

async function boot() {
  themeFromPreference();
  removePreviewBar();
  const me = await fetchMe();
  const state = mergePreview(me);
  window.odsSession.last = state;
  markNav(Boolean(state.user));
  applyCapabilities(state);
  paintAuth(state);
  document.dispatchEvent(new CustomEvent("ods:session", { detail: state }));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", themeFromPreference);
window.odsSession = { boot, TIER_NAME, setPreview, PERSONAS, last: null };
