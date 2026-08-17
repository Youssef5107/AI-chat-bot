import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { convertToModelMessages, streamText } from "ai";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openrouter("openrouter/free"),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
// you can destructure messages which is an
// array of all the messages that have been sent throught the chat with the ai
// or destructure a prompt which is the only the most recent message you
// have sent to the ai and either ways you will be passing this
// value to the ai function
