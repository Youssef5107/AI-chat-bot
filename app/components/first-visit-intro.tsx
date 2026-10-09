"use client";

import { useEffect, useState } from "react";
import { SaylaMark, SaylaWordmark } from "./sayla-brand";

const INTRO_SEEN_KEY = "sayla-intro-seen";
const INTRO_DURATION_MS = 2000;
const INTRO_EXIT_DURATION_MS = 300;

export default function FirstVisitIntro({
  playOnMount = false,
  durationMs = INTRO_DURATION_MS,
}: {
  playOnMount?: boolean;
  durationMs?: number;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const activationTimer = window.setTimeout(() => {
      if (!playOnMount) {
        try {
          if (window.sessionStorage.getItem(INTRO_SEEN_KEY)) return;
          window.sessionStorage.setItem(INTRO_SEEN_KEY, "true");
        } catch {
          // Show the intro even when browser storage is unavailable.
        }
      }
      setIsVisible(true);
    }, 0);

    return () => window.clearTimeout(activationTimer);
  }, [playOnMount]);

  useEffect(() => {
    if (!isVisible) return;

    const exitTimer = window.setTimeout(
      () => setIsExiting(true),
      durationMs - INTRO_EXIT_DURATION_MS,
    );
    const removeTimer = window.setTimeout(
      () => setIsVisible(false),
      durationMs,
    );

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(removeTimer);
    };
  }, [durationMs, isVisible]);

  if (!isVisible) return null;

  return (
    <div
      className={`sayla-intro ${isExiting ? "sayla-intro--exiting" : ""}`}
      role="status"
      aria-label="Sayla, The Writing and Thinking Studio"
    >
      <div className="sayla-intro__brand" aria-hidden="true">
        <SaylaMark size={112} className="sayla-intro__mark" />
        <div className="sayla-intro__wordmark">
          <SaylaWordmark />
        </div>
      </div>
    </div>
  );
}
