Relay AI is a single conversational workspace. The assistant selects tools from context for web search, image generation, structured recipe generation, and audio transcription.

## Configuration

Set the required provider keys in `.env.local`:

```env
GROQ_API_KEY=your-groq-api-key
POLLINATIONS_API_KEY=your-pollinations-api-key
```

Text chat, recipe generation, and chat titles use the Groq model configured in `lib/ai-models.ts` via `groq(TEXT_MODEL_ID)`. Image generation uses FLUX.1 Schnell through Pollinations. Audio transcription runs the quantized Whisper model locally in the Node.js server; the model downloads from Hugging Face on first use and is cached on the server. Supported audio formats include MP3, MP4, M4A, MPEG, MPGA, WAV, WebM, OGG, and FLAC, up to 25 MB.

Attach images, PDFs, and text files up to 8 MB each, or one audio file up to 25 MB. Up to four files can be attached to one message.

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
