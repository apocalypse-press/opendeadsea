(function (root) {
  const BUCKETS = [
    { key: "none", label: "No translation", badge: "badge" },
    { key: "ai", label: "AI translation", badge: "badge badge-info" },
    { key: "signoff", label: "Human sign off", badge: "badge badge-ok" },
    { key: "edit", label: "Human edit recommended", badge: "badge badge-warn" },
  ];
  const byKey = {};
  BUCKETS.forEach((b) => {
    byKey[b.key] = b;
  });

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  function rec(key) {
    return byKey[key] || byKey.none;
  }

  function join(mss, payload) {
    const rows = (payload && payload.manuscripts) || {};
    const fallback = (payload && payload.default) || "none";
    (mss || []).forEach((m) => {
      const hit = rows[m.id];
      m.queue = (hit && hit.queue) || fallback;
      m.queue_source = (hit && hit.source) || "derived";
    });
    return mss;
  }

  function load(mss) {
    return fetch("/data/translations/queue.json")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((payload) => join(mss, payload));
  }

  function badgeHTML(key) {
    const b = rec(key);
    return `<span class="${b.badge}">${esc(b.label)}</span>`;
  }

  function lede(key, translationCount) {
    if (key === "ai") {
      if (translationCount) {
        return `AI translation on ${translationCount} lines. Human sign off is the next step. Not the edition's translation`;
      }
      return "AI translation. Human sign off is the next step. Not the edition's translation";
    }
    if (key === "signoff") {
      return "Human sign off. A reviewer accepted this English without sending it back for rewrite";
    }
    if (key === "edit") {
      return "Human edit recommended. Do not sign off the machine English as it stands";
    }
    return "No translation in the edition yet";
  }

  function ensure() {
    return Promise.resolve(root.odsQueue);
  }

  root.odsQueue = { BUCKETS, rec, join, load, badgeHTML, lede, ensure };
})(window);
