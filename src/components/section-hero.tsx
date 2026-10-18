type SectionHeroProps = {
  section: string;
  phrase: string;
};

/** Shared cinematic heading used by the four main mentee sections. */
export function SectionHero({ section, phrase }: SectionHeroProps) {
  return (
    <header
      className="section-hero"
      aria-labelledby={`section-${section.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="section-hero__content page-width">
        <span>{section}</span>
        <i aria-hidden="true">
          <b />
          <em>◆</em>
          <b />
        </i>
        <h1 id={`section-${section.toLowerCase().replace(/\s+/g, "-")}`}>{phrase}</h1>
      </div>
    </header>
  );
}
