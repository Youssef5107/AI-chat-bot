This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Image Generation

The `/images` page uses a local Stable Diffusion WebUI-compatible API. One option is AUTOMATIC1111 WebUI; start it with its API enabled (`--api`) and a model loaded. By default, the app connects to `http://127.0.0.1:7860`.

To use a different server, add this to `.env.local` and restart the app:

```env
STABLE_DIFFUSION_API_URL=http://127.0.0.1:7860
```

The configured server must be reachable from the Next.js server and expose `POST /sdapi/v1/txt2img`. Local generation has no per-image API charge, but requires compatible hardware and a downloaded model. A deployed app needs a Stable Diffusion API endpoint reachable from its server environment.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
