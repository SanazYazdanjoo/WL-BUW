import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { InformationSections } from "../pages/InformationPage";
import { staffRequest } from "./service";
import { whatsappLink } from "../../shared/content";
function statusDate(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not recorded"
    : new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/Berlin",
      }).format(date);
}

function SemesterStatus({ onRestore }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([
      staffRequest("config"),
      staffRequest("content"),
      staffRequest("workspace"),
      staffRequest("sources"),
    ])
      .then(([config, content, workspace, sources]) => {
        if (active) setStatus({ config, content, workspace, sources: sources.sources });
      })
      .catch(() => {
        if (active) setError("Semester status is not available. Reload to try again.");
      });
    return () => { active = false; };
  }, []);

  if (error) return <p role="alert">{error}</p>;
  if (!status) return <p role="status">Loading semester status…</p>;

  const config = status.config.config;
  const publicSemester = status.content.content.config?.semesterLabel || "";
  const operationalSemester = status.workspace.data.semesterLabel || "";
  const knownSemesters = [config.semesterLabel, publicSemester, operationalSemester]
    .filter(Boolean);
  const semesterMismatch = new Set(knownSemesters).size > 1;
  const whatsappReady = Boolean(whatsappLink(config));
  const sources = status.sources || [];
  return (
    <section className="semester-status" aria-labelledby="semester-status-heading">
      <div className="staff-section-heading">
        <p className="staff-eyebrow">SEMESTER SETUP</p>
        <h2 id="semester-status-heading">Current status</h2>
      </div>
      {semesterMismatch && (
        <p className="semester-review-note">
          Semester labels do not match. Review the workbook and operational data before publishing.
        </p>
      )}
      <dl>
        <div>
          <dt>Current semester</dt>
          <dd>{config.semesterLabel || "Not set"}</dd>
        </div>
        <div>
          <dt>Public information</dt>
          <dd>{status.content.publishedAt
            ? `Last published ${statusDate(status.content.publishedAt)}${status.content.publishedBy ? ` by ${status.content.publishedBy}` : ""}`
            : "No workbook publication is recorded"}</dd>
        </div>
        <div>
          <dt>Content workbook</dt>
          <dd>{!status.content.workbook.available
            ? "Not found in the shared folder"
            : status.content.workbook.matchesPublished
              ? `No unpublished changes · updated ${statusDate(status.content.workbook.lastModified)}`
              : `Changes are ready to preview · updated ${statusDate(status.content.workbook.lastModified)}`}</dd>
        </div>
        <div>
          <dt>WhatsApp support</dt>
          <dd>{whatsappReady ? `Published · ${config.semesterLabel}` : "Not published"}</dd>
        </div>
        <div>
          <dt>MasterExcel data</dt>
          <dd>
            {status.workspace.data.lastImported
              ? `Last imported ${statusDate(status.workspace.data.lastImported)} · ${status.workspace.data.students.length} students`
              : "No import recorded"}
          </dd>
        </div>
        <div>
          <dt>Shift data</dt>
          <dd>{status.workspace.data.shifts.length
            ? `${status.workspace.data.shifts.length} shift dates loaded`
            : "No shift dates loaded"}</dd>
        </div>
        {sources.map((source) => (
          <div key={source.sourceId}>
            <dt>{source.label}</dt>
            <dd>
              {source.status === "current" ? "Current" :
                source.status === "stale" ? "Could not confirm recently" :
                  source.status === "needs-review" ? "Review required" : "No update available"}
              {" · "}{statusDate(source.lastSuccessfulCheck)}
            </dd>
          </div>
        ))}
      </dl>
      <nav aria-label="Semester setup actions" className="semester-actions">
        <Link to="/staff/data">Import operational data</Link>
        <Link to="/staff/sources">Refresh official information</Link>
        <a href="/api/staff/data/export">Export MasterExcel</a>
        {status.content.nextcloudBrowserUrl && <a href={status.content.nextcloudBrowserUrl} target="_blank" rel="noopener noreferrer">Open app folder in Nextcloud ↗</a>}
      </nav>
      {status.content.history?.length > 0 && (
        <section className="content-history" aria-labelledby="content-history-heading">
          <h3 id="content-history-heading">Previous publications</h3>
          <ul>
            {status.content.history.map((item) => (
              <li key={item.revision}>
                <span>{statusDate(item.publishedAt)} · {item.semester || "Semester not recorded"}{item.publishedBy ? ` · ${item.publishedBy}` : ""}</span>
                {item.restoredFrom ? <small>Restored from an earlier publication</small> : null}
                <button type="button" onClick={() => onRestore(item.revision)}>Restore</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}

function ReadableValue({ value }) {
  if (value === null || value === undefined || value === "")
    return <span>Not supplied</span>;
  if (Array.isArray(value))
    return (
      <ul>
        {value.map((v, i) => (
          <li key={i}>
            <ReadableValue value={v} />
          </li>
        ))}
      </ul>
    );
  if (typeof value === "object")
    return (
      <dl>
        {Object.entries(value)
          .filter(([k]) => !["source", "isActive", "isDemo", "id"].includes(k))
          .map(([k, v]) => (
            <div key={k}>
              <dt>{k.replace(/([A-Z])/g, " $1")}</dt>
              <dd>
                <ReadableValue value={v} />
              </dd>
            </div>
          ))}
      </dl>
    );
  return <span className="source-text">{String(value)}</span>;
}
export function ImportPage({ editorial = false }) {
  const { session } = useOutletContext();
  const [preview, setPreview] = useState(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [reviewed, setReviewed] = useState(false),
    [confirmSemester, setConfirmSemester] = useState(false),
    [resetProgress, setResetProgress] = useState(false),
    [semesterLabel, setSemesterLabel] = useState(""),
    [newSemester, setNewSemester] = useState(false);
  if (session.role !== "admin") return <p>Coordinator access is required.</p>;
  async function request(publish) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await staffRequest(
        editorial
          ? `content/${publish ? "publish" : "preview"}`
          : `data/${publish ? "import" : "preview"}`,
        {
          csrf: session.csrf,
          body: publish
            ? preview.sourceHash
              ? { sourceHash: preview.sourceHash, etag: preview.etag, reviewed, semesterLabel }
              : {
                proof: preview.proof,
                reviewed,
                confirm: reviewed,
                confirmSemester,
                resetProgress,
                semesterLabel,
                newSemester,
                }
            : {},
        },
      );
      if (publish) {
        setPreview(null);
        setMessage(
          editorial
            ? "Content published successfully."
            : "Staff records imported successfully.",
        );
      } else {
        setPreview(result);
        setReviewed(false);
        setConfirmSemester(false);
        setResetProgress(false);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function restore(revision) {
    if (!window.confirm("Restore this previous student content publication?")) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await staffRequest("content/rollback", { csrf: session.csrf, body: { revision, confirm: true } });
      setMessage("Previous content restored. Students will receive it without a deployment.");
      window.location.reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={`staff-page${editorial ? " staff-content-page" : ""}`}>
      <header className="staff-page-heading">
        <p className="staff-eyebrow">{editorial ? "COORDINATOR · CONTENT" : "COORDINATOR · DATA"}</p>
        <h1>
          {editorial ? "Content" : "Import & export staff data"}
        </h1>
        <p className="staff-page-lead">
          {editorial
            ? "Update student information from the shared workbook. Review every change before it goes live."
            : "Import or export the staff workbook. It remains a backup and transfer format, not the live database."}
        </p>
      </header>
      {editorial && (
        <>
          <ol className="content-workflow" aria-label="Content publishing steps">
            <li><span>01</span><strong>Edit workbook</strong></li>
            <li><span>02</span><strong>Preview changes</strong></li>
            <li><span>03</span><strong>Publish</strong></li>
          </ol>
          <SemesterStatus onRestore={restore} />
          <div className="content-workbook-help">
            <p><strong>Source workbook</strong></p>
            <p><code>content-source/Welcome-Lounge-Content.xlsx</code> in the private app folder.</p>
            <a href="/api/staff/content/template">Download clean workbook template</a>
          </div>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <div className="staff-primary-action">
        <button className="primary" disabled={busy} onClick={() => request(false)}>
          {editorial ? "Preview content update" : "Preview current workbook"}
        </button>
        {editorial && <span>Nothing is published until you review and confirm it.</span>}
      </div>
      {!editorial && (
        <div className="content-workbook-help">
          <p><strong>MasterExcel workbook</strong></p>
          <p>Download the sample to see the expected sheets and columns. Its fictional example rows are automatically skipped during import.</p>
          <p>
            <a href="/api/staff/data/template">Download sample MasterExcel.xlsx</a>
            {" · "}
            <a href="/api/staff/data/export">Export current MasterExcel</a>
          </p>
          <p><code>staff-data/state.json</code> is created automatically when the first staff change is saved. You do not need to upload it.</p>
        </div>
      )}
      {preview && (
        <section className="staff-review" aria-labelledby="review-heading">
          <div className="staff-section-heading">
            <p className="staff-eyebrow">REVIEW</p>
            <h2 id="review-heading">Review before confirming</h2>
          </div>
          {editorial ? (
            <>
              <p>Source: {preview.sourceFilename}</p>
              {preview.sourceLastModified && <p>Workbook updated {statusDate(preview.sourceLastModified)}</p>}
              <p>
                Workbook semester: <strong>{preview.semesterLabel}</strong>
              </p>
              <p>
                Currently configured:{" "}
                {preview.currentSemester || "Not configured"}
              </p>
              <p>
                {preview.content.onboarding.topics.length} steps ·{" "}
                {preview.content["health-insurance"].providers.length} providers
                · {preview.content["useful-links"].links.length} links ·{" "}
                {preview.content["support-resources"].resources.length} support resources ·{" "}
                {preview.content["community-resources"].resources.length} community links
              </p>
            </>
          ) : (
            <>
              <p>
                {preview.data.students.length} students ·{" "}
                {preview.data.programTutors.length} program tutor rows ·{" "}
                {preview.data.shifts.length} shift dates
              </p>
              <p>
                Currently stored: {preview.currentCount} students. Last import:{" "}
                {preview.lastImported || "Never"}.
              </p>
            </>
          )}
          <ul className="notice">
            {(editorial ? preview.warnings : preview.data.warnings).map(
              (w, i) => (
                <li key={i}>{w}</li>
              ),
            )}
          </ul>
          {editorial ? (
            preview.changes.map((change, i) => (
              <details key={i}>
                <summary>
                  {change.status}: {change.label}
                </summary>
                <div className="review-diff">
                  <section>
                    <h3>Before</h3>
                    <ReadableValue value={change.before} />
                  </section>
                  <section>
                    <h3>After</h3>
                    <ReadableValue value={change.after} />
                  </section>
                </div>
              </details>
            ))
          ) : (
            <details>
              <summary>Review imported rows</summary>
              <ReadableValue value={preview.data} />
            </details>
          )}
          <div className="staff-form">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={reviewed}
                onChange={(e) => setReviewed(e.target.checked)}
              />
              I reviewed the source text, counts and warnings.
            </label>
            {editorial ? (
              <>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={confirmSemester}
                    onChange={(e) => setConfirmSemester(e.target.checked)}
                  />
                  I confirm the workbook semester is the intended publication
                  semester.
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={resetProgress}
                    onChange={(e) => setResetProgress(e.target.checked)}
                  />
                  Start a new browser progress revision (required for a new
                  semester).
                </label>
              </>
            ) : (
              <>
                <label>
                  Operational semester
                  <input
                    required
                    value={semesterLabel}
                    maxLength={100}
                    onChange={(e) => setSemesterLabel(e.target.value)}
                  />
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={newSemester}
                    onChange={(e) => setNewSemester(e.target.checked)}
                  />
                  Start a new semester: archive current records and begin with
                  this import.
                </label>
                <p>
                  For the same semester, imported source fields replace matching
                  student fields; unmatched existing records remain. Review the
                  workbook before confirming.
                </p>
              </>
            )}
            <button
              className="primary"
              disabled={
                busy || !reviewed || (!editorial && !semesterLabel.trim())
              }
              onClick={() => request(true)}
            >
              {editorial
                ? "Publish reviewed content"
                : "Confirm reviewed import"}
            </button>
            <button disabled={busy} onClick={() => setPreview(null)}>
              Cancel preview
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
export function PrintCenter() {
  const { session } = useOutletContext();
  const [content, setContent] = useState(null),
    [error, setError] = useState(""),
    [selected, setSelected] = useState("all");
  useEffect(() => {
    if (session.role !== "admin") return;
    let active = true;
    staffRequest("content")
      .then((r) => {
        if (active) setContent(r.content);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [session.role]);
  if (session.role !== "admin") return <p>Coordinator access is required.</p>;
  return (
    <>
      <div className="print-controls">
        <h1>Print center</h1>
        <p>
          Print the currently published content using your browser’s A4 print or
          Save as PDF option.
        </p>
        <label>
          Handout
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="all">Full packet</option>
            <option value="onboarding">First steps</option>
            <option value="health-insurance">Insurance directory</option>
            <option value="useful-links">University portals</option>
            <option value="rundfunk">Rundfunkbeitrag</option>
          </select>
        </label>
        <button disabled={!content} onClick={() => window.print()}>
          Print / Save as PDF
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {content && (
        <div className="print-packet">
          {[
            ["onboarding", "Your first steps in Weimar"],
            ["health-insurance", "Health insurance directory"],
            ["useful-links", "University portals"],
            ["rundfunk", "Rundfunkbeitrag"],
          ]
            .filter(([kind]) => selected === "all" || selected === kind)
            .map(([kind, title]) => (
              <article className="print-handout" key={kind}>
                <header>
                  <p>Welcome Lounge · Bauhaus-Universität Weimar</p>
                  <h1>{title}</h1>
                  <p>
                    {content[kind]?.semesterLabel ||
                      content.config?.semesterLabel}{" "}
                    · Published{" "}
                    {content[kind]?.publishedAt?.slice(0, 10) || "Not yet"}
                  </p>
                </header>
                {!content[kind] ? (
                  <p>No content published.</p>
                ) : kind === "onboarding" ? (
                  content.onboarding.topics.map((topic) => (
                    <section key={topic.id}>
                      <h2>
                        {topic.order}. {topic.title}
                      </h2>
                      {topic.isDemo && (
                        <strong>
                          Sample content — not authoritative guidance
                        </strong>
                      )}
                      <p className="source-text">{topic.description}</p>
                      {topic.actions.length > 0 && (
                        <ol>
                          {topic.actions.map((a, i) => (
                            <li className="source-text" key={i}>
                              {a}
                            </li>
                          ))}
                        </ol>
                      )}
                      {topic.requiredItems.length > 0 && (
                        <>
                          <h3>Required items</h3>
                          <ul>
                            {topic.requiredItems.map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        </>
                      )}
                      {topic.importantNotes.map((n, i) => (
                        <p key={i}>{n}</p>
                      ))}
                    </section>
                  ))
                ) : (
                  <InformationSections kind={kind} data={content[kind]} />
                )}
              </article>
            ))}
        </div>
      )}
    </>
  );
}
