"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { assetPath } from "../assetPath.mjs";
import { DOWNLOAD_URL } from "../landingContent";
import {
  LATEST_RELEASE_API_URL,
  selectMacDownloadUrl,
  selectWindowsDownloadUrl,
} from "../landingDownload.mjs";
import { hero, site } from "../content/en";

export default function SignalStripHero() {
  const reduce = useReducedMotion();
  const [expanded, setExpanded] = useState(true);
  const [macUrl, setMacUrl] = useState(DOWNLOAD_URL);
  const [winUrl, setWinUrl] = useState(DOWNLOAD_URL);

  useEffect(() => {
    let cancelled = false;
    fetch(LATEST_RELEASE_API_URL)
      .then((r) => r.json())
      .then((release) => {
        if (cancelled) return;
        setMacUrl(selectMacDownloadUrl(release) || DOWNLOAD_URL);
        setWinUrl(selectWindowsDownloadUrl(release) || DOWNLOAD_URL);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="hero-signal" data-section="hero" id="top">
      <div className="hero-stage">
        <button
          type="button"
          className="signal-strip"
          data-expanded={expanded ? "true" : "false"}
          aria-expanded={expanded}
          aria-controls="signal-panel"
          aria-label={expanded ? "Collapse Headspace preview" : "Expand Headspace preview"}
          onClick={() => setExpanded((v) => !v)}
        >
          <span className="signal-grip" aria-hidden="true" />
        </button>

        <motion.div
          id="signal-panel"
          className="signal-panel"
          initial={false}
          animate={
            reduce
              ? { height: expanded ? "auto" : 0, opacity: expanded ? 1 : 0 }
              : {
                  height: expanded ? "auto" : 0,
                  opacity: expanded ? 1 : 0,
                }
          }
          transition={
            reduce
              ? { duration: 0 }
              : { duration: 0.24, ease: [0.22, 1, 0.36, 1] }
          }
          style={{ overflow: "hidden" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={assetPath("/brand/home.jpg")}
            alt="Headspace Home workspace"
            width={1840}
            height={1035}
          />
        </motion.div>

        <div className="hero-copy">
          <h1>{site.name}</h1>
          <p>{hero.outcome}</p>
          <div className="hero-trust" aria-label="Trust">
            {hero.trust.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
          <div className="cta-row">
            <a
              className="btn btn-primary"
              href={macUrl}
              data-primary-action="download-mac"
              data-direct-download="mac"
            >
              {hero.ctaMac}
            </a>
            <a
              className="btn btn-primary"
              href={winUrl}
              data-primary-action="download-windows"
              data-direct-download="windows"
            >
              {hero.ctaWin}
            </a>
          </div>
          <p className="mobile-note">{hero.mobileNote}</p>
        </div>
      </div>
    </section>
  );
}
