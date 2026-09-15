function Skel({ className }: { className?: string }) {
  return <span className={`dc-skel${className ? ` ${className}` : ""}`} aria-hidden="true" />;
}

export function SkelLine({ className }: { className?: string }) {
  return <Skel className={className ?? "dc-skel-line"} />;
}

export function LoadingSkeleton() {
  return (
    <article className="dc-result dc-skeleton" aria-busy="true" aria-label="Looking up word">
      <div className="dc-wordrow">
        <div className="dc-skeleton-head">
          <Skel className="dc-skel-word" />
          <Skel className="dc-skel-phon" />
        </div>
        <div className="dc-word-actions">
          <Skel className="dc-skel-circle" />
          <Skel className="dc-skel-pill" />
          <Skel className="dc-skel-circle" />
        </div>
      </div>

      <Skel className="dc-skel-gloss" />

      <div className="dc-senses">
        {[0, 1].map((i) => (
          <section className="dc-sense" key={i}>
            <Skel className="dc-skel-pos" />
            <ol className="dc-defs">
              {[0, 1].map((j) => (
                <li className="dc-def" key={j}>
                  <Skel className="dc-skel-def-en" />
                  <Skel className="dc-skel-def-zh" />
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </article>
  );
}
