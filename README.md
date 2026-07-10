# eraseline-backend

## Production configuration

The service uses PostgreSQL when `DATABASE_URL` is configured and falls back to
`DATA_DIR/store.json` for local development.

Required production environment variables:

- `DATABASE_URL`
- `AUTH_SECRET`
- `REVIEW_DEMO_EMAIL`
- `REVIEW_DEMO_PASSWORD`

The review credentials are bootstrapped as a Pro account at startup so App
Review retains full access after deploys and service restarts.
