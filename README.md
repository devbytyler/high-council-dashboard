# React + Vite + Hono + Cloudflare Workers

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/templates/tree/main/vite-react-template)

This template provides a minimal setup for building a React application with TypeScript and Vite, designed to run on Cloudflare Workers. It features hot module replacement, ESLint integration, and the flexibility of Workers deployments.

![React + TypeScript + Vite + Cloudflare Workers](https://imagedelivery.net/wSMYJvS3Xw-n339CbDyDIA/fc7b4b62-442b-4769-641b-ad4422d74300/public)

<!-- dash-content-start -->

🚀 Supercharge your web development with this powerful stack:

- [**React**](https://react.dev/) - A modern UI library for building interactive interfaces
- [**Vite**](https://vite.dev/) - Lightning-fast build tooling and development server
- [**Hono**](https://hono.dev/) - Ultralight, modern backend framework
- [**Cloudflare Workers**](https://developers.cloudflare.com/workers/) - Edge computing platform for global deployment

### ✨ Key Features

- 🔥 Hot Module Replacement (HMR) for rapid development
- 📦 TypeScript support out of the box
- 🛠️ ESLint configuration included
- ⚡ Zero-config deployment to Cloudflare's global network
- 🎯 API routes with Hono's elegant routing
- 🔄 Full-stack development setup
- 🔎 Built-in Observability to monitor your Worker

Get started in minutes with local development or deploy directly via the Cloudflare dashboard. Perfect for building modern, performant web applications at the edge.

<!-- dash-content-end -->

## Getting Started

To start a new project with this template, run:

```bash
npm create cloudflare@latest -- --template=cloudflare/templates/vite-react-template
```

A live deployment of this template is available at:
[https://react-vite-template.templates.workers.dev](https://react-vite-template.templates.workers.dev)

## Development

### Email admission

Access uses a fixed, server-side email allowlist. It does **not** verify email
ownership: anyone who knows an approved address can enter as that user.

For local development, copy `.dev.vars.example` to `.dev.vars`. Set
`ALLOWED_EMAILS` to a comma-separated list of approved addresses and
`SESSION_SECRET` to a random secret of at least 32 characters (generate one with
`openssl rand -hex 32`). Do not commit the populated file.

For production, configure both values as Cloudflare Worker secrets:

```bash
npx wrangler secret put ALLOWED_EMAILS
npx wrangler secret put SESSION_SECRET
```

Email matching ignores case and surrounding whitespace. Missing configuration
denies access. Sessions last 24 hours in signed, HttpOnly, SameSite cookies
(Secure on HTTPS); all `/api/*` routes except login and logout require a valid
session. Removing an address revokes its access on its next API request.
The static application shell is public; keep private data behind protected APIs,
not in bundled client files or public assets.

The browser remembers the last successful email in local storage and offers
"Continue as" on later visits, including after signing out or session expiry.
"Use a different email" clears the remembered address. Continuing always checks
the server allowlist again; the stored address is not proof of access.

Run admission tests with `npm test` using Node.js 22.18+ (native TypeScript support).

Install dependencies:

```bash
npm install
```

Start the development server with:

```bash
npm run dev
```

Your application will be available at [http://localhost:5173](http://localhost:5173).

## Production

Build your project for production:

```bash
npm run build
```

Preview your build locally:

```bash
npm run preview
```

Deploy your project to Cloudflare Workers:

```bash
npm run build && npm run deploy
```

Monitor your workers:

```bash
npx wrangler tail
```

## Additional Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Vite Documentation](https://vitejs.dev/guide/)
- [React Documentation](https://reactjs.org/)
- [Hono Documentation](https://hono.dev/)
