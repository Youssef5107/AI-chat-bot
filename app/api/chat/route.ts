import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();
  // you can destructure messages which is an
  // array of all the messages that have been sent throught the chat with the ai
  // or destructure a prompt which is the only the most recent message you
  // have sent to the ai and either ways you will be passing this
  // value to the ai function

  const result = streamText({
    model: openai(`gpt-4o`),
    messages,
  });

  return result.toUIMessageStreamResponse();
}
