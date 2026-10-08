import { isRecord } from "@/lib/chat-utils";

export default function ChatToolResult({ value }: { value: unknown }) {
  if (!isRecord(value) || typeof value.kind !== "string") return null;

  if (
    value.kind === "image" &&
    typeof value.imageUrl === "string" &&
    value.imageUrl.startsWith("data:image/")
  ) {
    return (
      <figure className="mt-4 overflow-hidden border border-[#20251f]/10 bg-[#e8e9de]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={value.imageUrl}
          alt={
            typeof value.prompt === "string" ? value.prompt : "Generated image"
          }
          className="max-h-[65vh] w-full object-contain"
        />
        {typeof value.prompt === "string" && (
          <figcaption className="border-t border-[#20251f]/10 px-4 py-3 text-xs text-[#666b60]">
            {value.prompt}
          </figcaption>
        )}
      </figure>
    );
  }

  if (value.kind === "recipe" && isRecord(value.recipe)) {
    const recipe = value.recipe;
    const ingredients = Array.isArray(recipe.ingredients)
      ? recipe.ingredients.filter(isRecord)
      : [];
    const steps = Array.isArray(recipe.steps)
      ? recipe.steps.filter((step): step is string => typeof step === "string")
      : [];
    const sources = Array.isArray(recipe.sources)
      ? recipe.sources.filter(
          (source): source is { title: string; url: string } =>
            isRecord(source) &&
            typeof source.title === "string" &&
            typeof source.url === "string",
        )
      : [];

    return (
      <section className="mt-4 border border-[#20251f]/10 bg-[#f8f6ef] p-4 sm:p-5">
        <h3 className="font-serif text-2xl text-(--leaf)">
          {typeof recipe.name === "string" ? recipe.name : "Your recipe"}
        </h3>
        <div className="mt-4 grid gap-5 sm:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h4 className="font-mono text-[9px] uppercase tracking-widest text-[#85897e]">
              Ingredients
            </h4>
            <ul className="mt-2 space-y-1 text-sm text-[#42483f]">
              {ingredients.map((ingredient, index) => (
                <li key={`${String(ingredient.name)}-${index}`}>
                  <span className="font-medium">
                    {typeof ingredient.name === "string"
                      ? ingredient.name
                      : "Item"}
                  </span>
                  {typeof ingredient.amount === "string" && (
                    <span className="text-[#85877d]">
                      {" "}
                      · {ingredient.amount}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-mono text-[9px] uppercase tracking-widest text-[#85897e]">
              Method
            </h4>
            <ol className="mt-2 list-inside list-decimal space-y-2 text-sm leading-6 text-[#42483f]">
              {steps.map((step, index) => (
                <li key={`${index}-${step}`}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
        {sources.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-[#20251f]/10 pt-3">
            {sources.map((source) => (
              <li key={source.url}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-(--leaf) underline underline-offset-4 hover:text-(--tomato)"
                >
                  {source.title}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  if (value.kind === "transcription" && typeof value.text === "string") {
    return (
      <section className="mt-4 border border-[#20251f]/10 bg-[#f8f6ef] p-4 sm:p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-mono text-[9px] uppercase tracking-widest text-(--leaf)">
            Transcript
            {typeof value.fileName === "string" ? ` · ${value.fileName}` : ""}
          </h3>
          {typeof value.durationInSeconds === "number" && (
            <span className="font-mono text-[9px] text-[#85897e]">
              {Math.floor(value.durationInSeconds / 60)}:
              {String(Math.floor(value.durationInSeconds % 60)).padStart(
                2,
                "0",
              )}
            </span>
          )}
        </div>
        <p className="whitespace-pre-wrap text-sm leading-7 text-[#42483f]">
          {value.text}
        </p>
      </section>
    );
  }

  return null;
}
