import { onRequestPost as createProposal } from "../functions/api/proposals.js";
import { onRequestPost as voteProposal } from "../functions/api/proposals/[id]/vote.js";
import { sessionCookieValue } from "../functions/_lib/session.js";

class FakeD1 {
  constructor(tier = 1) {
    this.tier = tier;
    this.proposals = new Set(["p_existing"]);
  }

  prepare(sql) {
    const db = this;
    return {
      bind(...args) {
        return {
          async first() {
            if (sql.includes("FROM users")) {
              return {
                user_id: "42",
                github_username: "reader42",
                reputation_score: 0,
                tier_level: db.tier,
                academic_verified: 0,
              };
            }
            if (sql.includes("FROM proposals")) {
              return db.proposals.has(String(args[0])) ? { id: String(args[0]) } : null;
            }
            return null;
          },
          async all() {
            return { results: [] };
          },
          async run() {
            if (sql.includes("INSERT INTO proposals")) db.proposals.add(String(args[0]));
            return { success: true };
          },
        };
      },
    };
  }
}

async function requestFor(env, body, tier = 3) {
  const token = await sessionCookieValue(env, { id: "42", login: "reader42", tier });
  return new Request("https://opendeadsea.org/api/test", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `ods_session=${encodeURIComponent(token)}`,
    },
    body: JSON.stringify(body),
  });
}

const contributorEnv = { SESSION_SECRET: "test-secret", DB: new FakeD1(1) };
const createResponse = await createProposal({
  request: await requestFor(contributorEnv, {
    mss_id: "1Qisaa",
    mss_label: "1QIsaa",
    line_ref: "1QIsaa 1:1",
    current_form: "Old draft",
    proposed_form: "Clearer English",
    reason: "",
  }),
  env: contributorEnv,
});
if (createResponse.status !== 201) throw new Error(`proposal status ${createResponse.status}`);
const created = await createResponse.json();
if (!created.proposal || !created.proposal.id.startsWith("p_")) throw new Error("server did not mint proposal id");
if (created.proposal.author_login !== "reader42") throw new Error("server did not own author identity");
if (!created.proposal.reason) throw new Error("optional note did not receive a public default");

const demotedVote = await voteProposal({
  request: await requestFor(contributorEnv, { vote_value: 1 }, 3),
  env: contributorEnv,
  params: { id: "p_existing" },
});
if (demotedVote.status !== 403) throw new Error("stale editor cookie retained review authority");

const reviewerEnv = { SESSION_SECRET: "test-secret", DB: new FakeD1(2) };
const missingVote = await voteProposal({
  request: await requestFor(reviewerEnv, { vote_value: 1 }, 2),
  env: reviewerEnv,
  params: { id: "p_missing" },
});
if (missingVote.status !== 404) throw new Error("vote accepted for a missing proposal");

console.log("review API: pass");
