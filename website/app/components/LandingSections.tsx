import { assetPath } from "../assetPath.mjs";
import { alerts, getIt, site, trust, workspace } from "../content/en";

export function TrustSection() {
  return (
    <section className="section" data-section="trust" id="features">
      <span className="kicker">{trust.kicker}</span>
      <h2>Local by design.</h2>
      <div className="trust-grid">
        {trust.items.map(([title, body]) => (
          <article className="trust-card" key={title}>
            <h3>{title}</h3>
            <p>{body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function WorkspaceSection() {
  return (
    <section className="section" data-section="workspace" id="workspace">
      <span className="kicker">{workspace.kicker}</span>
      <h2>{workspace.title}</h2>
      <div className="job-grid">
        {workspace.jobs.map((job) => (
          <article className="job-card" key={job.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={assetPath(job.image)} alt="" loading="lazy" />
            <h3>{job.title}</h3>
            <p>{job.blurb}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function AlertsSection() {
  return (
    <section className="section" data-section="alerts">
      <span className="kicker">{alerts.kicker}</span>
      <h2>{alerts.title}</h2>
      <div className="alerts-panel">
        <p>{alerts.body}</p>
        <p className="mono-line">127.0.0.1:43821 /notify/&lt;source&gt;</p>
        <div className="source-chips">
          {alerts.sources.map((s) => (
            <span key={s}>{s}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

export function GetItSection() {
  return (
    <section className="section" data-section="get-it" id="get-it">
      <span className="kicker">{getIt.kicker}</span>
      <h2>{getIt.title}</h2>
      <div className="get-box">
        <p className="gate">{getIt.gatekeeper}</p>
        <span className="kicker">{getIt.brewLabel}</span>
        <code className="brew">{site.brew}</code>
        <a className="btn" href={`${site.github}/issues`} target="_blank" rel="noreferrer">
          {getIt.issues}
        </a>
      </div>
    </section>
  );
}
