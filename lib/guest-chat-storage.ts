import type { UIMessage } from "ai";

const STORAGE_KEY = "sayla-guest-chats-v1";
const MAX_GUEST_CHATS = 30;

export type GuestChat = {
  id: string;
  title: string;
  updatedAt: string;
  messages: UIMessage[];
};

export type GuestChatSummary = Pick<GuestChat, "id" | "title" | "updatedAt">;

function readGuestChats(): GuestChat[] {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "[]",
    );
    if (!Array.isArray(value)) return [];
    return value.filter(
      (chat): chat is GuestChat =>
        typeof chat === "object" &&
        chat !== null &&
        "id" in chat &&
        typeof chat.id === "string" &&
        chat.id.startsWith("guest-") &&
        "title" in chat &&
        typeof chat.title === "string" &&
        "updatedAt" in chat &&
        typeof chat.updatedAt === "string" &&
        "messages" in chat &&
        Array.isArray(chat.messages),
    );
  } catch {
    return [];
  }
}

function writeGuestChats(chats: GuestChat[]) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        chats
          .sort((first, second) =>
            second.updatedAt.localeCompare(first.updatedAt),
          )
          .slice(0, MAX_GUEST_CHATS),
      ),
    );
    return true;
  } catch {
    return false;
  }
}

export function loadGuestChats(): GuestChat[] {
  return readGuestChats().sort((first, second) =>
    second.updatedAt.localeCompare(first.updatedAt),
  );
}

export function loadGuestChat(chatId: string) {
  return readGuestChats().find((chat) => chat.id === chatId) ?? null;
}

export function createGuestChat(firstMessage: string): GuestChat {
  const normalized = firstMessage.replace(/\s+/g, " ").trim();
  const lower = normalized.toLocaleLowerCase();
  let title = normalized
    .split(" ")
    .slice(0, 5)
    .join(" ")
    .replace(/[.!?]+$/, "");

  if (/^(hi|hello|hey|مرحبا|أهلا|اهلا)(\b|$)/iu.test(normalized)) {
    title = "Greeting";
  } else if (/\bweather\b.*\b(in|at|for)\b/i.test(normalized)) {
    const place = normalized.match(/\b(?:in|at|for)\s+(.+?)[?.!]*$/i)?.[1];
    if (place) title = `${place.replace(/[?.!,]+$/g, "").trim()} Weather`;
  } else if (/^(what is|what are|define|explain)\s+/i.test(normalized)) {
    const subject = normalized
      .replace(/^(what is|what are|define|explain)\s+/i, "")
      .replace(/[?.!]+$/, "")
      .trim();
    title = `${subject} Overview`;
  } else if (!lower) {
    title = "New chat";
  }

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? `guest-${crypto.randomUUID()}`
      : `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    id,
    title: title.slice(0, 80) || "New chat",
    updatedAt: new Date().toISOString(),
    messages: [],
  };
}

export function saveGuestChat(chat: GuestChat) {
  const chats = readGuestChats().filter((existing) => existing.id !== chat.id);
  return writeGuestChats([
    { ...chat, updatedAt: new Date().toISOString() },
    ...chats,
  ]);
}

export function renameGuestChat(chatId: string, title: string) {
  const chats = readGuestChats();
  const index = chats.findIndex((chat) => chat.id === chatId);
  if (index < 0) return false;
  chats[index] = {
    ...chats[index],
    title,
    updatedAt: new Date().toISOString(),
  };
  return writeGuestChats(chats);
}

export function deleteGuestChat(chatId: string) {
  const chats = readGuestChats();
  return writeGuestChats(chats.filter((chat) => chat.id !== chatId));
}
