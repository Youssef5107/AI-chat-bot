import Link from "next/link";

type ChatNavigationProps = {
  active: "main" | "recipe" | "images" | "transcription";
};

const destinations = [
  {
    id: "main",
    href: "/chat",
    number: "01",
    label: "Main chat",
    detail: "Open conversation",
  },
  {
    id: "recipe",
    href: "/structured-date",
    number: "02",
    label: "Recipe chat",
    detail: "Cook something good",
  },
  {
    id: "images",
    href: "/images",
    number: "03",
    label: "Image studio",
    detail: "Make a new image",
  },
  {
    id: "transcription",
    href: "/transcription",
    number: "04",
    label: "Transcription",
    detail: "Turn audio into text",
  },
] as const;

export default function ChatNavigation({ active }: ChatNavigationProps) {
  return (
    <aside className="border-b border-[#20251f]/15 bg-[#eeebdf] px-5 pb-4 pt-4 md:fixed md:inset-y-0 md:left-0 md:z-30 md:flex md:w-57 md:flex-col md:border-b-0 md:border-r md:px-6 md:py-7">
      <Link
        href="/chat"
        className="page-enter flex w-fit items-center gap-3"
        aria-label="Relay AI home"
      >
        <span className="grid size-9 place-items-center rounded-full bg-(--tomato) font-serif text-xl italic text-white">
          r
        </span>
        <span className="font-serif text-[22px] leading-none tracking-tight text-(--ink)">
          Relay <span className="text-(--leaf)">AI</span>
        </span>
      </Link>

      <div className="mt-3 hidden font-mono text-[9px] uppercase tracking-[0.16em] text-[#929387] md:block">
        Your AI workspace
      </div>

      <nav
        aria-label="Chat destinations"
        className="mt-4 grid grid-cols-2 gap-2 md:mt-14 md:flex md:flex-col"
      >
        {destinations.map((destination) => {
          const isActive = active === destination.id;
          return (
            <Link
              key={destination.id}
              href={destination.href}
              aria-current={isActive ? "page" : undefined}
              className={`lift-on-hover group flex min-h-11 flex-1 items-center gap-3 border px-3 py-2.5 transition-colors md:flex-none md:gap-3.5 ${
                isActive
                  ? "border-[#426047]/20 bg-[#e2e7dc] text-[#29452f]"
                  : "border-transparent text-[#70756b] hover:border-[#20251f]/10 hover:bg-white/50 hover:text-(--ink)"
              }`}
            >
              <span
                className={`font-serif text-sm italic ${isActive ? "text-(--tomato)" : "text-[#a2a398]"}`}
              >
                {destination.number}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-medium sm:text-sm">
                  {destination.label}
                </span>
                <span className="mt-0.5 hidden font-mono text-[9px] uppercase tracking-widest text-[#96998e] md:block">
                  {destination.detail}
                </span>
              </span>
              {isActive && (
                <span className="ml-auto hidden size-1.5 rounded-full bg-(--tomato) md:block" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto hidden border-t border-[#20251f]/15 pt-4 md:block">
        <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#85897e]">
          One assistant, four spaces
        </p>
        <p className="mt-1 text-xs text-[#a0a195]">
          Ideas, recipes, images, audio.
        </p>
      </div>
    </aside>
  );
}
