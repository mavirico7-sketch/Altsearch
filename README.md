# AltSearch

AltSearch is an AI content generator and search platform built on modern web technologies. The project is fully containerized and divided into modular services for easy Self-Hosted deployment.

## Tech Stack

*   **Framework:** Next.js (App Router), React, TypeScript.
*   **Styling:** Vanilla CSS (no heavy libraries like Tailwind).
*   **Database:** libSQL (SQLite-compatible), ORM — Drizzle.
*   **Authentication:** NextAuth.js (Auth.js v5) — supports Google, GitHub, and local credentials.
*   **AI & LLM:** Supports any OpenAI-compatible API providers (Google, OpenAI, Anthropic, Custom endpoints). Local embeddings are handled via `@huggingface/transformers`. Additionally, through the `cliproxy` service, web-based AI subscription providers can be integrated.
*   **Infrastructure:** Docker, Docker Compose, Nginx Proxy Manager.

## Architecture and Services (Docker Compose)

The project is deployed via `docker-compose.yml` and consists of several key components (containers):

1.  **`web` (Next.js Application)**
    *   *Role:* The core application. Serves the UI (Frontend), handles API requests (Backend), communicates with the database, and sends prompts to the selected AI providers.
    *   *Default Port:* `3000`
2.  **Database (Local File)**
    *   *Role:* Stores user data, history, sessions, and agent configurations. Instead of a heavy DBMS, it uses a local `altsearch.db` file (via libSQL) mounted to the `/data` folder using a Docker volume. Existing `wikigen.db` files are still accepted as a legacy fallback.
3.  **`npm` (Nginx Proxy Manager)** — *Profile: `npm`*
    *   *Role:* A reverse proxy with a user-friendly Web UI. It binds to ports `80` and `443`, routing traffic to the `web` container. Automatically manages Let's Encrypt SSL certificates.
    *   *Admin Port:* `81`
4.  **`cliproxy` (CLI Proxy API)** — *Profile: `proxy`*
    *   *Role:* An optional service that allows connecting web-based AI subscriptions (like ChatGPT Plus, Claude Pro, Gemini Advanced) as standard API providers using web tokens.

## Configuration

The project uses a hybrid configuration system for maximum security and convenience:

*   **`.env`**: Stores ONLY sensitive information (API tokens, NextAuth secrets, Google/GitHub OAuth IDs).
*   **`config.yaml`**: Stores common (non-secret) application settings. Examples include the running port, local login permissions (`allow_local_login: true`), and OpenRouter model presets.

## Project Management (Scripts)

The root directory contains launch scripts (`.sh` for Linux/macOS and `.bat` for Windows) to quickly spin up different configurations:

*   **`start.sh`**: Starts only the `web` application (ideal for local development).
*   **`start-npm.sh`**: Starts `web` + Nginx Proxy Manager (optimal for Production without third-party proxy subscriptions).
*   **`start-proxy.sh`**: Starts `web` + `cliproxy` (subscription integration mode).
*   **`start-full.sh`**: Starts all services at once.
*   **`stop.sh`**: Stops all running services and removes orphan containers for this project.
