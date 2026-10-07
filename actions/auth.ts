"use server";

import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/lib/auth";

export async function register(_prev: string | undefined, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .toLowerCase()
    .trim();
  const password = String(formData.get("password") ?? "");

  if (!email || password.length < 8) {
    return "Enter an email and a password of at least 8 characters.";
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return "An account with this email already exists.";

  await prisma.user.create({
    data: { name, email, password: await bcrypt.hash(password, 12) },
  });

  try {
    await signIn("credentials", { email, password, redirectTo: "/" });
  } catch (error) {
    if (error instanceof AuthError)
      return "Account created, but sign-in failed.";
    throw error; // the redirect itself is thrown, so it must be rethrown
  }
}

export async function login(_prev: string | undefined, formData: FormData) {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) return "Invalid email or password.";
    throw error;
  }
}
