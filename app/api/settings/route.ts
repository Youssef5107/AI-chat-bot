import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json(
      { error: "Sign in to view account settings." },
      { status: 401 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      password: true,
      createdAt: true,
      _count: { select: { chats: true } },
    },
  });
  if (!user)
    return Response.json({ error: "Account not found." }, { status: 404 });

  return Response.json({
    name: user.name ?? "",
    email: user.email ?? "",
    hasPassword: Boolean(user.password),
    createdAt: user.createdAt,
    chatCount: user._count.chats,
  });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json(
      { error: "Sign in to update account settings." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "The settings request was not valid." },
      { status: 400 },
    );
  }
  if (typeof body !== "object" || body === null) {
    return Response.json(
      { error: "The settings request was not valid." },
      { status: 400 },
    );
  }

  const values = body as Record<string, unknown>;
  const name =
    typeof values.name === "string"
      ? values.name.trim().replace(/\s+/g, " ")
      : undefined;
  const email =
    typeof values.email === "string"
      ? values.email.trim().toLowerCase()
      : undefined;
  const currentPassword =
    typeof values.currentPassword === "string" ? values.currentPassword : "";
  const newPassword =
    typeof values.newPassword === "string" ? values.newPassword : "";

  if (name !== undefined && (!name || name.length > 80)) {
    return Response.json(
      { error: "Display name must be between 1 and 80 characters." },
      { status: 400 },
    );
  }
  if (email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }
  if (newPassword && newPassword.length < 8) {
    return Response.json(
      { error: "New password must be at least 8 characters." },
      { status: 400 },
    );
  }
  if (!name && !email && !newPassword) {
    return Response.json(
      { error: "There are no account changes to save." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { password: true, email: true },
  });
  if (!user)
    return Response.json({ error: "Account not found." }, { status: 404 });

  const changesSensitiveCredentials =
    Boolean(newPassword) || (email !== undefined && email !== user.email);
  if (changesSensitiveCredentials) {
    if (!user.password || !currentPassword) {
      return Response.json(
        {
          error:
            "Enter your current password to change your email or password.",
        },
        { status: 400 },
      );
    }
    if (!(await bcrypt.compare(currentPassword, user.password))) {
      return Response.json(
        { error: "Your current password is incorrect." },
        { status: 400 },
      );
    }
  }

  try {
    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(newPassword
          ? { password: await bcrypt.hash(newPassword, 12) }
          : {}),
      },
      select: { name: true, email: true },
    });

    return Response.json(updated);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return Response.json(
        { error: "That email address is already in use." },
        { status: 409 },
      );
    }
    throw error;
  }
}
