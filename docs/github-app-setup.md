# GitHub App setup (hand-holding)

You will create one free GitHub App on the **apocalypse-press** organization.
That App is how a contributor signs in on opendeadsea.org and opens a pull
request under their own GitHub identity. It costs nothing.

Do this while signed in as an org owner (your `elcafe7` account).
Do **not** email anyone the Client secret or the private key.

Direct form (opens the org App form):

https://github.com/organizations/apocalypse-press/settings/apps/new

If that 404s: GitHub → your profile → **apocalypse-press** → **Settings**
→ **Developer settings** → **GitHub Apps** → **New GitHub App**.

---

## 1. Identity fields (paste these)

| Field | Value |
|---|---|
| GitHub App name | `Open Dead Sea` |
| Description | `Lets a contributor propose a corpus edit on opendeadsea.org as a GitHub pull request under their own account.` |
| Homepage URL | `https://opendeadsea.org/` |
| Callback URL | `https://opendeadsea.org/auth/callback` |
| Setup URL | leave blank |
| Setup URL on update | leave unchecked |
| Webhook Active | **uncheck** (GitHub Actions already watch pull requests) |
| Webhook URL | leave blank if webhook is off |
| Expire user authorization tokens | **checked** (GitHub default; keep it) |
| Request user authorization (OAuth) during installation | **checked** |
| Enable Device Flow | unchecked |

Callback is a placeholder until the login page exists. GitHub will accept
it. We will add that route before anyone but you signs in.

---

## 2. Permissions (set only these)

Under **Repository permissions**:

| Permission | Set to |
|---|---|
| Metadata | Read-only (locked; leave it) |
| Contents | Read and write |
| Pull requests | Read and write |
| Issues | Read and write |

Issues write is required so CI and the App can comment on a pull request.
Leave every other repository permission at No access.

Under **Organization permissions**: all **No access**.

Under **Account permissions**:

| Permission | Set to |
|---|---|
| Email addresses | Read-only |

That is enough to know who signed in. Do not request followers, gists, or
administration.

---

## 3. Where it can be installed

Choose **Only on this account**.

That keeps the App on apocalypse-press. Contributors do not install it on
their personal account. They only click **Authorize** when they Suggest
Edit. You install it once on the org repo.

---

## 4. Create, then copy four values

Click **Create GitHub App**.

On the next page, write down (password manager or a file mode 600, not
chat, not email):

1. **App ID** (a number at the top of the App settings page)
2. **Client ID**
3. **Client secret** (Generate a new client secret)
4. **Private key** (Generate a private key). A `.pem` file downloads.
   Keep that file. We need the whole PEM later as a Wrangler / Actions
   secret.

Also note the **App slug** in the URL
(`https://github.com/apps/open-dead-sea` or similar).

---

## 5. Install it on the repo

1. On the App settings page, click **Install App** (left sidebar).
2. Next to **apocalypse-press**, click **Install**.
3. Choose **Only select repositories**.
4. Select **opendeadsea** only. Not the whole org. Not dss-explorer.
5. Click **Install**.

You should land on a URL like
`https://github.com/settings/installations/NNNN`. That installation is
what lets the App see `apocalypse-press/opendeadsea`.

---

## 6. What to send back

Reply with only:

- App ID
- Client ID
- App slug (the `/apps/...` name)
- Confirmation that it is installed on `opendeadsea` only
- Confirmation that the `.pem` is saved on your machine

Do **not** paste the Client secret or the PEM. When we wire login I will
ask you to drop those into Wrangler secrets on the VPS, not into mail.

---

## Why this shape

Open Dead Sea opens the pull request as the signed-in user, not as a bot.
That is a user-to-server token from this App. GitHub Actions still runs
`pr-validation.yml` on every PR. Webhooks on the App stay off so we do
not need a Worker just to receive them.
