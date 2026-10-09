import { auth } from "@/lib/auth";
import { generateChatTitle } from "@/lib/chat-title";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json(
      { error: "Sign in to view chat history." },
      { status: 401 },
    );
  }

  const chats = await prisma.chat.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true },
  });

  return Response.json(chats);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json(
      { error: "Sign in to start a saved chat." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid chat request." }, { status: 400 });
  }

  const firstMessage =
    typeof body === "object" &&
    body !== null &&
    "firstMessage" in body &&
    typeof body.firstMessage === "string"
      ? body.firstMessage.trim().slice(0, 2000)
      : "";
  const title = await generateChatTitle(firstMessage);
  const chat = await prisma.chat.create({
    data: { userId: session.user.id, title },
    select: { id: true, title: true, updatedAt: true },
  });

  return Response.json(chat, { status: 201 });
}
