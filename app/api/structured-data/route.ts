import { streamObject } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { recipeSchema } from "./schema";

export const maxDuration = 60;

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_FILE_BYTES = 12 * 1024 * 1024;
const MAX_FILES = 4;

function isSupportedFile(file: File) {
  return (
    file.type.startsWith("image/") ||
    file.type.startsWith("text/") ||
    file.type === "application/pdf"
  );
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const dishValue = formData.get("dish");
    const dish = typeof dishValue === "string" ? dishValue.trim() : "";
    const files = formData
      .getAll("files")
      .filter(
        (value): value is File => value instanceof File && value.size > 0,
      );

    if (!dish && files.length === 0) {
      return Response.json(
        { error: "Describe a dish or attach an image or file." },
        { status: 400 },
      );
    }
    if (files.length > MAX_FILES) {
      return Response.json(
        { error: `Attach up to ${MAX_FILES} files per recipe.` },
        { status: 400 },
      );
    }
    if (files.some((file) => !isSupportedFile(file))) {
      return Response.json(
        { error: "Attach images, PDFs, or text-based files." },
        { status: 415 },
      );
    }
    if (files.some((file) => file.size > MAX_FILE_BYTES)) {
      return Response.json(
        { error: "Each file must be 8 MB or smaller." },
        { status: 413 },
      );
    }
    const totalFileBytes = files.reduce((total, file) => total + file.size, 0);
    if (totalFileBytes > MAX_TOTAL_FILE_BYTES) {
      return Response.json(
        { error: "Attachments must total 12 MB or less." },
        { status: 413 },
      );
    }

    const recipeRequest = dish
      ? `Generate a practical, flavorful recipe for ${dish}. Use the attached image(s) or file(s) as context when relevant. Include clear ingredient amounts and concise numbered cooking steps.`
      : "Generate a practical, flavorful recipe inspired by the attached image(s) or file(s). Include clear ingredient amounts and concise numbered cooking steps.";
    const content = [
      { type: "text" as const, text: recipeRequest },
      ...(await Promise.all(
        files.map(async (file) => ({
          type: "file" as const,
          data: new Uint8Array(await file.arrayBuffer()),
          mediaType: file.type,
          filename: file.name,
        })),
      )),
    ];

    const result = streamObject({
      model: openrouter("openrouter/free"),
      schema: recipeSchema,
      messages: [{ role: "user", content }],
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "The recipe could not be generated. Please try again." },
      { status: 500 },
    );
  }
}
