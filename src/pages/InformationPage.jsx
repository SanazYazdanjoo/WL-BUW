import { Link, useOutletContext } from "react-router-dom";
export function InformationSections({ kind, data }) {
  if (kind === "health-insurance")
    return data.providers.length ? (
      data.providers.map((provider) => (
        <section key={provider.id} className="information-section">
          <h2>{provider.name}</h2>
          <p className="source-text">{provider.address}</p>
          <dl>
            {Object.entries(provider.openingHours)
              .filter(([, hours]) => hours)
              .map(([day, hours]) => (
                <div key={day}>
                  <dt>{day.charAt(0).toUpperCase() + day.slice(1)}</dt>
                  <dd>{hours}</dd>
                </div>
              ))}
          </dl>
        </section>
      ))
    ) : (
      <p>No insurance directory has been published yet.</p>
    );
  if (kind === "useful-links")
    return data.links.length ? (
      data.links.map((link) => (
        <section key={link.id} className="information-section">
          <h2>
            <a href={link.url} target="_blank" rel="noopener noreferrer">
              {link.title}
            </a>
          </h2>
          <p className="source-text">{link.description}</p>
          <span className="print-url">{link.url}</span>
        </section>
      ))
    ) : (
      <p>No portal links have been published yet.</p>
    );
  return data.sections.length ? (
    data.sections.map((section, index) => (
      <section key={index} className="information-section">
        <h2>{section.heading}</h2>
        {section.paragraphs.map((p, i) => (
          <p className="source-text" key={i}>
            {p}
          </p>
        ))}
      </section>
    ))
  ) : (
    <p>This information has not been published yet.</p>
  );
}
export default function InformationPage({ kind, title }) {
  const { content } = useOutletContext();
  const result = content[kind];
  return (
    <article className="topic">
      <Link to="/journey">Back to your journey</Link>
      <header className="page-heading">
        <p className="eyebrow">
          {result.data.semesterLabel || content.config.data.semesterLabel}
        </p>
        <h1>{title}</h1>
        {result.data.publishedAt && (
          <p>Published {result.data.publishedAt.slice(0, 10)}</p>
        )}
      </header>
      <InformationSections kind={kind} data={result.data} />
    </article>
  );
}
