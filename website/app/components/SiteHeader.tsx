"use client";

import { assetPath } from "../assetPath.mjs";
import { nav, site } from "../content/en";

export default function SiteHeader() {
  return (
    <header className="site-header">
      <a className="brand-lockup" href="#top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={assetPath("/brand/mark.png")} alt="" width={28} height={28} />
        <span>{site.name}</span>
      </a>
      <nav className="site-nav" aria-label="Primary">
        {nav.map((item) =>
          item.id === "github" ? (
            <a key={item.id} href={item.href} data-nav-github="" target="_blank" rel="noreferrer">
              {item.label}
            </a>
          ) : (
            <a key={item.id} href={item.href}>
              {item.label}
            </a>
          ),
        )}
      </nav>
    </header>
  );
}
