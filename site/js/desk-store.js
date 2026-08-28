(function (root) {
  const KEY = "ods.desk.v1";
  const READ_KEY = "ods.desk.read.";
  const SEED = "/data/desk-seed.json";

  function empty() {
    return { proposals: [], comments: [], events: [], git: [] };
  }

  function nid(prefix) {
    const raw = (crypto.randomUUID && crypto.randomUUID().replace(/-/g, "").slice(0, 16)) || String(Date.now());
    return prefix + "_" + raw;
  }

  function nowIso() {
    return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  }

  function byId(list) {
    const map = new Map();
    (list || []).forEach((item) => {
      if (item && item.id) map.set(item.id, item);
    });
    return map;
  }

  function overlay(base, extra) {
    const map = byId(base);
    (extra || []).forEach((item) => {
      if (item && item.id) map.set(item.id, item);
    });
    return Array.from(map.values()).sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  }

  function loadLocal() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "null") || empty();
    } catch {
      return empty();
    }
  }

  function saveLocal(state) {
    const slim = {
      proposals: state.proposals || [],
      comments: state.comments || [],
      events: state.events || [],
    };
    localStorage.setItem(KEY, JSON.stringify(slim));
  }

  function readSet(userId) {
    try {
      return new Set(JSON.parse(localStorage.getItem(READ_KEY + (userId || "anon")) || "[]"));
    } catch {
      return new Set();
    }
  }

  function saveRead(userId, set) {
    localStorage.setItem(READ_KEY + (userId || "anon"), JSON.stringify(Array.from(set)));
  }

  function reviewerApprovals(votes) {
    return (votes || []).filter((v) => Number(v.vote_value) === 1).length;
  }

  function statusAfterVotes(votes, maintainerApprove) {
    if (maintainerApprove) return "approved";
    const yes = reviewerApprovals(votes);
    const no = (votes || []).some((v) => Number(v.vote_value) === -1);
    if (yes >= 2) return "ready";
    if (no) return "changes";
    return "open";
  }

  function statusLabel(status) {
    return (
      {
        open: "Open",
        changes: "Changes requested",
        ready: "Ready for editor",
        approved: "Approved",
        withdrawn: "Withdrawn",
      }[status] || "Open"
    );
  }

  function badgeClass(status) {
    if (status === "approved") return "badge badge-ok";
    if (status === "ready") return "badge badge-info";
    if (status === "changes") return "badge badge-warn";
    return "badge";
  }

  let cache = empty();

  async function load() {
    const seed = await fetch(SEED)
      .then((r) => (r.ok ? r.json() : empty()))
      .catch(() => empty());
    const local = loadLocal();
    const remote = await fetch("/api/desk", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    if (remote && Array.isArray(remote.proposals)) {
      // The shared desk is authoritative. Never mix browser-only sample or
      // optimistic records into a live response: other readers must see the
      // same proposal ids and state.
      cache = {
        proposals: remote.proposals || [],
        comments: remote.comments || [],
        events: remote.events || [],
        git: remote.git || [],
        source: remote.source || "remote",
      };
    } else {
      cache = {
        proposals: overlay(seed.proposals, local.proposals),
        comments: overlay(seed.comments, local.comments),
        events: overlay(seed.events, local.events),
        git: [],
        source: "local",
      };
    }
    return cache;
  }

  function snapshot() {
    return cache;
  }

  function addEvent(state, rec) {
    state.events = overlay(state.events, [rec]);
  }

  function persist(state) {
    cache = state;
    saveLocal(state);
    root.dispatchEvent(new CustomEvent("ods:desk", { detail: state }));
    return state;
  }

  async function post(url, body) {
    try {
      const res = await fetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    } catch {
      return { ok: false, status: 0, data: {} };
    }
  }

  function postError(result, fallback) {
    const error = new Error((result.data && result.data.error) || fallback);
    error.status = result.status;
    return error;
  }

  async function addComment(user, payload) {
    const result = await post("/api/comments", payload);
    if (!result.ok || !result.data.comment) {
      throw postError(result, "The comment could not be saved. Please try again.");
    }
    const rec = result.data.comment;
    const state = snapshot();
    state.comments = overlay(state.comments, [rec]);
    addEvent(state, {
      id: nid("e"),
      kind: "comment",
      mss_id: rec.target_type === "mss" ? rec.target_id : "",
      title: `${user.login} commented on ${rec.target_id}`,
      href:
        rec.target_type === "mss"
          ? `/m/${encodeURIComponent(rec.target_id)}/${rec.line_ref ? `?line=${encodeURIComponent(rec.line_ref)}` : ""}`
          : `/proposal/?id=${encodeURIComponent(rec.target_id)}`,
      login: user.login,
      created_at: rec.created_at,
    });
    persist(state);
    return rec;
  }

  async function addProposal(user, payload) {
    const result = await post("/api/proposals", payload);
    if (!result.ok || !result.data.proposal) {
      throw postError(result, "The suggestion could not be saved. Please try again.");
    }
    const rec = result.data.proposal;
    const state = snapshot();
    state.proposals = overlay(state.proposals, [rec]);
    addEvent(state, {
      id: nid("e"),
      kind: "proposal",
      mss_id: rec.mss_id,
      title: `${user.login} proposed a reading on ${rec.mss_label}`,
      href: `/proposal/?id=${encodeURIComponent(rec.id)}`,
      login: user.login,
      created_at: rec.created_at,
    });
    persist(state);
    return rec;
  }

  async function vote(user, proposalId, voteValue, comment) {
    const state = snapshot();
    const proposal = state.proposals.find((p) => p.id === proposalId);
    if (!proposal) throw new Error("Proposal not found");
    const result = await post(`/api/proposals/${encodeURIComponent(proposalId)}/vote`, {
      vote_value: voteValue,
      comment: comment || "",
    });
    if (!result.ok || !result.data.vote) {
      throw postError(result, "The review could not be saved. Please try again.");
    }
    const votes = (proposal.votes || []).filter((v) => v.voter_user_id !== user.id);
    votes.push(result.data.vote);
    proposal.votes = votes;
    proposal.status = result.data.status || statusAfterVotes(votes, false);
    proposal.updated_at = nowIso();
    addEvent(state, {
      id: nid("e"),
      kind: voteValue === 1 ? "vote-approve" : "vote-changes",
      mss_id: proposal.mss_id,
      title: `${user.login} ${voteValue === 1 ? "approved" : "asked for changes on"} ${proposal.mss_label}`,
      href: `/proposal/?id=${encodeURIComponent(proposal.id)}`,
      login: user.login,
      created_at: proposal.updated_at,
    });
    persist(state);
    return proposal;
  }

  async function approve(user, proposalId) {
    const state = snapshot();
    const proposal = state.proposals.find((p) => p.id === proposalId);
    if (!proposal) throw new Error("Proposal not found");
    const result = await post(`/api/proposals/${encodeURIComponent(proposalId)}/approve`, {});
    if (!result.ok) {
      throw postError(result, "The approval could not be saved. Please try again.");
    }
    proposal.status = result.data.status || "approved";
    proposal.updated_at = nowIso();
    addEvent(state, {
      id: nid("e"),
      kind: "approved",
      mss_id: proposal.mss_id,
      title: `${user.login} recorded approval on ${proposal.mss_label}`,
      href: `/proposal/?id=${encodeURIComponent(proposal.id)}`,
      login: user.login,
      created_at: proposal.updated_at,
    });
    persist(state);
    return proposal;
  }

  function queueFor(user) {
    const state = snapshot();
    const items = [];
    (state.comments || []).forEach((c) => {
      items.push({
        id: c.id,
        kind: c.parent_id ? "reply" : "comment",
        title: c.parent_id ? `Reply on ${c.target_id}` : `Comment on ${c.target_id}`,
        blurb: c.body,
        at: c.created_at,
        login: c.author_login,
        href:
          c.target_type === "proposal"
            ? `/proposal/?id=${encodeURIComponent(c.target_id)}`
            : `/m/${encodeURIComponent(c.target_id)}/${c.line_ref ? `?line=${encodeURIComponent(c.line_ref)}` : ""}`,
      });
    });
    (state.proposals || []).forEach((p) => {
      const yes = reviewerApprovals(p.votes);
      items.push({
        id: p.id,
        kind: "proposal",
        title: `Translation suggestion on ${p.mss_label || p.mss_id}`,
        blurb: `${statusLabel(p.status)} · ${yes} reviewer approval${yes === 1 ? "" : "s"}`,
        at: p.updated_at || p.created_at,
        login: p.author_login,
        status: p.status,
        href: `/proposal/?id=${encodeURIComponent(p.id)}`,
      });
    });
    items.sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
    const read = readSet(user && user.id);
    return items.map((item) => ({ ...item, unread: user ? !read.has(item.id) : false }));
  }

  function markRead(user, id) {
    if (!user) return;
    const set = readSet(user.id);
    set.add(id);
    saveRead(user.id, set);
  }

  function commentsFor(targetType, targetId, lineRef) {
    return (snapshot().comments || []).filter((c) => {
      if (c.target_type !== targetType || c.target_id !== targetId) return false;
      if (lineRef) return c.line_ref === lineRef;
      return true;
    });
  }

  function proposalsFor(mssId, lineRef) {
    return (snapshot().proposals || []).filter((p) => {
      if (p.mss_id !== mssId) return false;
      if (lineRef) return p.line_ref === lineRef;
      return true;
    });
  }

  function getProposal(id) {
    return (snapshot().proposals || []).find((p) => p.id === id) || null;
  }

  root.odsDesk = {
    load,
    snapshot,
    addComment,
    addProposal,
    vote,
    approve,
    queueFor,
    markRead,
    commentsFor,
    proposalsFor,
    getProposal,
    statusLabel,
    badgeClass,
    reviewerApprovals,
    nowIso,
  };
})(window);
