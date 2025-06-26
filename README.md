# AI Agent Management & Workflow Automation Platform

This project is a platform designed to help banks (or other organizations) manage AI agents and automate complex workflows. It provides capabilities to define agent templates, configure specific agent instances, design workflows that orchestrate these agents and human tasks, and manage the execution of these workflows.

## Project info

**URL**: https://lovable.dev/projects/7d905d6d-0adb-4536-975c-13f21fb3101a

## Core Features (Phase 1)

*   **User Authentication:** Secure login and registration.
*   **Agent Template Management:** Define types of AI agents (e.g., "Loan Document Checker") and their configurable parameters via JSON schemas.
*   **Configured Agent Instances:** Allow users to create and manage specific instances of agent templates with their bank-specific configurations.
*   **Workflow Engine (Basic):**
    *   Define workflow structures (sequences of agent executions and human tasks).
    *   Initiate and track workflow runs.
    *   Manage tasks assigned to users.
*   **API Documentation:** Interactive API documentation available via Swagger UI.

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/7d905d6d-0adb-4536-975c-13f21fb3101a) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the frontend development server (Vite)
# Typically on http://localhost:8080
npm run dev

# Step 5: (In a new terminal) Start the backend development server (Node.js/Express)
# Typically on http://localhost:3001 (see backend/.env.example for port)
# Ensure you have a .env file in the backend/ directory configured (see backend/.env.example)
# and your PostgreSQL database is running and schema applied (backend/sql/schema.sql).
npm run dev:backend

# Access API Documentation (Swagger UI)
# Once the backend is running, navigate to http://localhost:3001/api-docs (or your configured backend port)
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Frontend: Vite, TypeScript, React, shadcn-ui, Tailwind CSS
- Backend: Node.js, Express.js, TypeScript, PostgreSQL
- API Documentation: Swagger/OpenAPI

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/7d905d6d-0adb-4536-975c-13f21fb3101a) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
