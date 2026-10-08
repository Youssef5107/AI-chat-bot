import Image from "next/image";

export function SaylaMark({
  size = 48,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/sayla-mark.svg"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={className}
      priority
    />
  );
}

export function SaylaWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="font-serif leading-none text-[#171715]">
      <span className={compact ? "text-[22px]" : "text-[38px]"}>
        say<span className="italic text-[#bf5538]">la</span>
      </span>
      {!compact && (
        <span className="mt-1.5 block whitespace-nowrap font-sans text-[7px] uppercase tracking-[0.12em] text-[#85786f]">
          The Writing &amp; Thinking Studio
        </span>
      )}
    </span>
  );
}

export function SaylaBrand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <SaylaMark size={compact ? 36 : 48} className="shrink-0 rounded-[14px]" />
      <SaylaWordmark compact={compact} />
    </span>
  );
}
