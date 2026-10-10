import { createGroq } from "@ai-sdk/groq";

const apiKey = process.env.GROQ_API_KEY ?? "";

export const groq = createGroq({
  apiKey,
});
