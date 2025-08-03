# AI Agent Management & Workflow Automation Platform

This project is a platform designed to help banks (or other organizations) manage AI agents and automate complex workflows. It provides capabilities to define agent templates, configure specific agent instances, design workflows that orchestrate these agents and human tasks, and manage the execution of these workflows.


## Core Features (Phase 1)

*   **User Authentication:** Secure login and registration.
*   **Agent Template Management:** Define types of AI agents (e.g., "Loan Document Checker") and their configurable parameters via JSON schemas.
*   **Configured Agent Instances:** Allow users to create and manage specific instances of agent templates with their bank-specific configurations.
*   **Workflow Engine (Basic):**
    *   Define workflow structures (sequences of agent executions and human tasks).
    *   Initiate and track workflow runs.
    *   Manage tasks assigned to users.
*   **API Documentation:** Interactive API documentation available via Swagger UI.

## What technologies are used for this project?

This project is built with:

- Frontend: Vite, TypeScript, React, shadcn-ui, Tailwind CSS
- Backend: Node.js, Express.js, TypeScript, PostgreSQL
- API Documentation: Swagger/OpenAPI

