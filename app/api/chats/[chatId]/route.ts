import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chatId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json(
      { error: "Sign in to view this chat." },
      { status: 401 },
    );
  }

  const { chatId } = await params;
  const chat = await prisma.chat.findFirst({
    where: { id: chatId, userId: session.user.id },
    select: {
      id: true,
      title: true,
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, role: true, parts: true },
      },
    },
  });

  if (!chat)
    return Response.json({ error: "Chat not found." }, { status: 404 });
  return Response.json(chat);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json(
      { error: "Sign in to rename this chat." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid rename request." }, { status: 400 });
  }

  const title =
    typeof body === "object" &&
    body !== null &&
    "title" in body &&
    typeof body.title === "string"
      ? body.title.trim().slice(0, 80)
      : "";
  if (!title) {
    return Response.json({ error: "Enter a chat title." }, { status: 400 });
  }

  const { chatId } = await params;
  const updated = await prisma.chat.updateMany({
    where: { id: chatId, userId: session.user.id },
    data: { title },
  });
  if (updated.count === 0) {
    return Response.json({ error: "Chat not found." }, { status: 404 });
  }

  return Response.json({ id: chatId, title });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ chatId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json(
      { error: "Sign in to delete this chat." },
      { status: 401 },
    );
  }

  const { chatId } = await params;
  const deleted = await prisma.chat.deleteMany({
    where: { id: chatId, userId: session.user.id },
  });
  if (deleted.count === 0) {
    return Response.json({ error: "Chat not found." }, { status: 404 });
  }

  return new Response(null, { status: 204 });
}
