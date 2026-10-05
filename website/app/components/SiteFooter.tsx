import { footer, site } from "../content/en";

export default function SiteFooter() {
  return (
    <footer className="site-footer" data-section="footer">
      <span>{footer.platforms}</span>
      <span>
        <a href={site.github} target="_blank" rel="noreferrer">
          GitHub
        </a>
        {" / "}
        {footer.copy}
      </span>
    </footer>
  );
}
