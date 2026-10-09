"use client";

import { useEffect, useState } from "react";
import { SaylaMark, SaylaWordmark } from "./sayla-brand";

const INTRO_SEEN_KEY = "sayla-intro-seen";
const INTRO_DURATION_MS = 2000;
const INTRO_EXIT_DURATION_MS = 300;

export default function FirstVisitIntro() {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const activationTimer = window.setTimeout(() => {
      try {
        if (window.sessionStorage.getItem(INTRO_SEEN_KEY)) return;
        window.sessionStorage.setItem(INTRO_SEEN_KEY, "true");
      } catch {
        // Show the intro even when browser storage is unavailable.
      }
      setIsVisible(true);
    }, 0);

    return () => window.clearTimeout(activationTimer);
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const exitTimer = window.setTimeout(
      () => setIsExiting(true),
      INTRO_DURATION_MS - INTRO_EXIT_DURATION_MS,
    );
    const removeTimer = window.setTimeout(
      () => setIsVisible(false),
      INTRO_DURATION_MS,
    );

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(removeTimer);
    };
  }, [isVisible]);

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
