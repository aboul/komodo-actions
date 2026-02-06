# 🚀 Komodo Actions — GitHub Action for Komodo Deployments

**Komodo Actions** is a GitHub Action that allows you to automate Komodo
operations (like deploying stacks or running procedures) directly from your
GitHub workflows.

It is designed for developers and homelab/infrastructure admins who use Komodo
for orchestrating Docker stacks, builds, and procedures.

---

## 📦 What this action does

This action:

- Interacts with the **Komodo API** to launch operations
- Waits for operations to complete
- Returns a summary of the results
- Generates a **GitHub Actions-friendly summary** of the deployment

Examples of what you can do:

- Deploy one or multiple Komodo stacks
- Run Komodo procedures
- Integrate into CI/CD or GitOps workflows

---

## 🧠 Key concepts

### 📌 `kind`

The action supports different Komodo resource types:

| Kind        | Meaning                    |
| ----------- | -------------------------- |
| `stack`     | Deploy a Komodo stack      |
| `procedure` | Execute a Komodo procedure |

> Each `kind` maps to a specific Komodo API operation executed by the GitHub
> Action.

---

## ⚙️ Inputs

| Name         | Required | Description                                                |
| ------------ | -------- | ---------------------------------------------------------- |
| `kind`       | ✅       | `stack` or `procedure`                                     |
| `patterns`   | ✅       | JSON array of target names (e.g. `["frontend","backend"]`) |
| `komodo-url` | ❌       | Komodo API URL (can be set via env)                        |
| `api-key`    | ❌       | Komodo API key (can be set via env)                        |
| `api-secret` | ❌       | Komodo API secret (can be set via env)                     |
| `dry-run`    | ❌       | `true` to skip execution                                   |

📌 **Credentials (`komodo-url`, `api-key`, `api-secret`) can also be provided
via environment variables** instead of workflow inputs.

---

## ▶️ Example usage

Deploy two Komodo stacks:

```yaml
name: Deploy stacks

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v5

      - name: Deploy stacks
        uses: aboul/komodo-actions@v1.0.0
        with:
          komodo-url: ${{ secrets.KOMODO_URL }}
          api-key: ${{ secrets.KOMODO_API_KEY }}
          api-secret: ${{ secrets.KOMODO_API_SECRET }}
          kind: stack
          patterns: '["immich","umami"]'
```

or run one procedure, using env instead of inputs for credentials :

```yaml
name: Deploy stacks

on:
  push:
    branches:
      - main

env:
  KOMODO_URL: ${{ secrets.KOMODO_URL }}
  KOMODO_API_KEY: ${{ secrets.KOMODO_API_KEY }}
  KOMODO_API_SECRET: ${{ secrets.KOMODO_API_SECRET }}

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v5

      - name: Deploy stacks
        uses: aboul/komodo-actions@v1.0.0
        with:
          kind: procedure
          patterns: '["test-procedure"]'
```

---

## 🧪 Dry-run (optional)

Test the action without actually executing operations:

```yaml
with:
  dry-run: true
```

In this mode, no API calls are made.

---

## 📝 Deployment summary

At the end of execution, the action:

- Collects update IDs and statuses
- Exposes them via a GitHub Actions output (outputs.updates)
- Generates a job summary table in the GitHub UI

The summary includes a table with Update ID and their Status (e.g., Complete).

---

## 🔐 Secrets management

Store your secrets in GitHub Secrets:

```
Settings → Secrets and variables → Actions
```

Then reference them in your workflow:

```yaml
env:
  KOMODO_URL: ${{ secrets.KOMODO_URL }}
  KOMODO_API_KEY: ${{ secrets.KOMODO_API_KEY }}
  KOMODO_API_SECRET: ${{ secrets.KOMODO_API_SECRET }}
```

---

## 📜 License

MIT License — free to use.
