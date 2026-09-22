# Focus Guard AI Auth Starter

This project includes a professional login and registration UI with a forgot-password flow, split into separate frontend and backend folders.

## Structure
- Backend: [backend](backend)
- Frontend: [frontend](frontend)
- Docker setup: [docker-compose.yml](docker-compose.yml)

## Run with Docker
From the project root:

```bash
docker compose up --build
```

Then open:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000/api/health

## Features
- Register page with first name, last name, email, and password
- Password validation: minimum 6 characters, one uppercase letter, one number, and one special character
- Login page
- Forgot password flow
- General-purpose AI chatbot with optional focus-data context

## Configure the AI chatbot

The chatbot uses the OpenAI Responses API on the backend, so the API key is never sent to the browser.

1. Create an API key in the OpenAI dashboard.
2. Add it to `backend/.env`:

```env
OPENAI_API_KEY=your_openai_api_key_here
# Optional
OPENAI_MODEL=gpt-4.1-mini
```

3. Restart the backend (or Docker Compose).

For Docker Compose, put `OPENAI_API_KEY=...` in a root `.env` file or export it in your shell before running `docker compose up`.
