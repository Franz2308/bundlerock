// BundleRock Downloader - Content Script
// Injects an isolated, IDM-style floating download button over video players

(function () {
  "use strict";

  // Prevent multiple injections
  if (window.__BUNDLEROCK_CONTENT_SCRIPT_INJECTED__) return;
  window.__BUNDLEROCK_CONTENT_SCRIPT_INJECTED__ = true;

  let isEnabled = true;
  let currentTargetVideo = null;
  let lastContextMenuTarget = null;
  let hideTimeoutId = null;
  let isHoveringButton = false;
  let isHoveringVideo = false;
  let isBusy = false;
  let lastMouseMoveTime = 0;
  let animationFrameId = null;

  // Retrieve user settings
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get({ showFloatingButton: true }, (items) => {
      isEnabled = items.showFloatingButton !== false;
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local" && changes.showFloatingButton) {
        isEnabled = changes.showFloatingButton.newValue !== false;
        if (!isEnabled) {
          hideButtonNow();
        }
      }
    });
  }

  // --- Shadow DOM Setup ---
  const hostElement = document.createElement("div");
  hostElement.id = "bundlerock-floating-host";

  // Attach closed Shadow DOM to isolate styles completely from host pages
  const shadowRoot = hostElement.attachShadow({ mode: "closed" });

  const styleElement = document.createElement("style");
  styleElement.textContent = `
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    .br-floating-container {
      position: fixed;
      top: 0;
      left: 0;
      visibility: hidden;
      opacity: 0;
      pointer-events: none;
      z-index: 2147483647;
      transition: opacity 0.18s cubic-bezier(0.16, 1, 0.3, 1);
      user-select: none;
      -webkit-user-select: none;
      will-change: opacity, transform;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }

    .br-floating-container.is-visible {
      visibility: visible;
      opacity: 1;
      pointer-events: auto;
    }

    .br-button {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      background: rgba(15, 23, 42, 0.88);
      border: 1px solid rgba(56, 189, 248, 0.32);
      border-radius: 12px;
      padding: 0;
      cursor: pointer;
      box-shadow:
        0 4px 14px -1px rgba(0, 0, 0, 0.55),
        0 2px 5px -1px rgba(0, 0, 0, 0.35),
        inset 0 1px 0 rgba(255, 255, 255, 0.12);
      backdrop-filter: blur(12px) saturate(180%);
      -webkit-backdrop-filter: blur(12px) saturate(180%);
      transition:
        background-color 0.18s ease,
        border-color 0.18s ease,
        box-shadow 0.18s ease,
        transform 0.14s cubic-bezier(0.34, 1.56, 0.64, 1);
      outline: none;
      text-decoration: none;
      will-change: transform;
    }

    .br-button:hover {
      background: rgba(15, 23, 42, 0.95);
      border-color: rgba(56, 189, 248, 0.7);
      box-shadow:
        0 8px 24px -2px rgba(0, 0, 0, 0.65),
        0 0 14px rgba(56, 189, 248, 0.35),
        inset 0 1px 0 rgba(255, 255, 255, 0.2);
      transform: scale(1.08);
    }

    .br-button:active {
      transform: scale(0.92);
      border-color: rgba(56, 189, 248, 0.9);
      box-shadow:
        0 2px 8px rgba(0, 0, 0, 0.6),
        0 0 16px rgba(56, 189, 248, 0.45),
        inset 0 1px 0 rgba(255, 255, 255, 0.15);
    }

    .br-button:focus-visible {
      outline: none;
      box-shadow:
        0 0 0 2px #0f172a,
        0 0 0 4px rgba(56, 189, 248, 0.85);
    }

    /* Cyan pulse ring on click */
    .br-button.is-pulsing::after {
      content: "";
      position: absolute;
      inset: -1px;
      border-radius: inherit;
      border: 2px solid rgba(56, 189, 248, 0.9);
      pointer-events: none;
      animation: br-pulse-ring 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    @keyframes br-pulse-ring {
      0% {
        opacity: 1;
        transform: scale(1);
        box-shadow: 0 0 12px rgba(56, 189, 248, 0.85);
      }
      100% {
        opacity: 0;
        transform: scale(1.45);
        box-shadow: 0 0 22px rgba(56, 189, 248, 0);
      }
    }

    /* BundleRock Central Emblem */
    .br-emblem {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: linear-gradient(135deg, #244a77 0%, #1a365d 100%);
      border: 1px solid rgba(255, 255, 255, 0.35);
      box-shadow:
        0 1px 3px rgba(0, 0, 0, 0.45),
        inset 0 1px 1px rgba(255, 255, 255, 0.25),
        inset 0 -1px 2px rgba(56, 189, 248, 0.25);
      flex-shrink: 0;
      transition:
        border-color 0.18s ease,
        box-shadow 0.18s ease,
        background 0.18s ease;
      pointer-events: none;
    }

    .br-button:hover .br-emblem {
      border-color: rgba(56, 189, 248, 0.8);
      background: linear-gradient(135deg, #2b568a 0%, #1e3f6d 100%);
      box-shadow:
        0 2px 6px rgba(0, 0, 0, 0.5),
        inset 0 1px 1px rgba(255, 255, 255, 0.35),
        0 0 8px rgba(56, 189, 248, 0.35);
    }

    .br-icon {
      width: 14px;
      height: 14px;
      stroke-width: 2.5;
      stroke: #ffffff;
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
      filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.4));
      transition: stroke 0.18s ease, filter 0.18s ease;
    }

    .br-button:hover .br-icon-arrow {
      stroke: #ffffff;
      filter: drop-shadow(0 0 3px rgba(56, 189, 248, 0.95)) drop-shadow(0 1px 1px rgba(0, 0, 0, 0.4));
    }

    /* States */
    .br-button.is-loading {
      background: rgba(15, 23, 42, 0.95);
      border-color: rgba(56, 189, 248, 0.55);
      cursor: wait;
    }

    .br-button.is-loading .br-emblem {
      background: #1a365d;
      border-color: rgba(56, 189, 248, 0.5);
    }

    .br-button.is-loading .br-icon-spinner {
      stroke: #38bdf8;
      stroke-width: 2.5;
      transform-origin: center;
      animation: br-spin 0.8s linear infinite;
    }

    .br-button.is-success {
      background: rgba(15, 23, 42, 0.95);
      border-color: rgba(16, 185, 129, 0.7);
      box-shadow: 0 8px 24px -2px rgba(0, 0, 0, 0.65), 0 0 14px rgba(16, 185, 129, 0.4);
    }

    .br-button.is-success .br-emblem {
      background: linear-gradient(135deg, #059669 0%, #047857 100%);
      border-color: rgba(52, 211, 153, 0.85);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.35);
    }

    .br-button.is-success .br-icon-success {
      stroke: #ffffff;
      stroke-width: 2.5;
      filter: drop-shadow(0 0 3px rgba(52, 211, 153, 0.8));
    }

    .br-button.is-error {
      background: rgba(15, 23, 42, 0.95);
      border-color: rgba(239, 68, 68, 0.7);
      box-shadow: 0 8px 24px -2px rgba(0, 0, 0, 0.65), 0 0 14px rgba(239, 68, 68, 0.4);
    }

    .br-button.is-error .br-emblem {
      background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
      border-color: rgba(248, 113, 113, 0.85);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.35);
    }

    .br-button.is-error .br-icon-error {
      stroke: #ffffff;
      stroke-width: 2.5;
    }

    /* Floating Tooltip */
    .br-tooltip {
      position: absolute;
      top: 50%;
      right: calc(100% + 9px);
      transform: translateY(-50%) translateX(4px);
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      color: #f8fafc;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.02em;
      white-space: nowrap;
      max-width: min(240px, calc(100vw - 64px));
      text-overflow: ellipsis;
      overflow: hidden;
      padding: 5px 9px;
      border-radius: 6px;
      border: 1px solid rgba(56, 189, 248, 0.28);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.55), 0 0 10px rgba(56, 189, 248, 0.12);
      pointer-events: none;
      opacity: 0;
      visibility: hidden;
      transition:
        opacity 0.16s cubic-bezier(0.16, 1, 0.3, 1),
        transform 0.16s cubic-bezier(0.16, 1, 0.3, 1),
        visibility 0.16s;
      z-index: 10;
    }

    .br-tooltip::after {
      content: "";
      position: absolute;
      top: 50%;
      right: -5px;
      transform: translateY(-50%) rotate(45deg);
      width: 8px;
      height: 8px;
      background: #0f172a;
      border-top: 1px solid rgba(56, 189, 248, 0.28);
      border-right: 1px solid rgba(56, 189, 248, 0.28);
    }

    .br-button:hover + .br-tooltip,
    .br-button:focus-visible + .br-tooltip,
    .br-button.is-loading + .br-tooltip,
    .br-button.is-success + .br-tooltip,
    .br-button.is-error + .br-tooltip {
      opacity: 1;
      visibility: visible;
      transform: translateY(-50%) translateX(0);
    }

    .br-floating-container.tooltip-right .br-tooltip {
      right: auto;
      left: calc(100% + 9px);
      transform: translateY(-50%) translateX(-4px);
    }

    .br-floating-container.tooltip-right .br-tooltip::after {
      right: auto;
      left: -5px;
      border-top: none;
      border-right: none;
      border-bottom: 1px solid rgba(56, 189, 248, 0.28);
      border-left: 1px solid rgba(56, 189, 248, 0.28);
    }

    .br-floating-container.tooltip-right .br-button:hover + .br-tooltip,
    .br-floating-container.tooltip-right .br-button:focus-visible + .br-tooltip,
    .br-floating-container.tooltip-right .br-button.is-loading + .br-tooltip,
    .br-floating-container.tooltip-right .br-button.is-success + .br-tooltip,
    .br-floating-container.tooltip-right .br-button.is-error + .br-tooltip {
      opacity: 1;
      visibility: visible;
      transform: translateY(-50%) translateX(0);
    }

    @keyframes br-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;

  const container = document.createElement("div");
  container.className = "br-floating-container";

  container.innerHTML = `
    <button class="br-button" type="button" aria-label="Descargar con BundleRock">
      <span class="br-emblem">
        <!-- ArrowDown icon (BundleRock emblem) -->
        <svg class="br-icon br-icon-arrow" viewBox="0 0 24 24">
          <path d="M12 5v14"></path>
          <path d="m19 12-7 7-7-7"></path>
        </svg>
        <!-- Spinner icon (loading) -->
        <svg class="br-icon br-icon-spinner" viewBox="0 0 24 24" style="display: none;">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
        </svg>
        <!-- Success icon (check) -->
        <svg class="br-icon br-icon-success" viewBox="0 0 24 24" style="display: none;">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <!-- Error icon (X cross) -->
        <svg class="br-icon br-icon-error" viewBox="0 0 24 24" style="display: none;">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </span>
    </button>
    <div class="br-tooltip" role="tooltip">Descargar con BundleRock</div>
  `;

  shadowRoot.appendChild(styleElement);
  shadowRoot.appendChild(container);

  const button = container.querySelector(".br-button");
  const tooltip = container.querySelector(".br-tooltip");
  const iconArrow = container.querySelector(".br-icon-arrow");
  const iconSpinner = container.querySelector(".br-icon-spinner");
  const iconSuccess = container.querySelector(".br-icon-success");
  const iconError = container.querySelector(".br-icon-error");

  function setButtonState(state, customTooltip) {
    iconArrow.style.display = "none";
    iconSpinner.style.display = "none";
    iconSuccess.style.display = "none";
    iconError.style.display = "none";
    button.classList.remove("is-loading", "is-success", "is-error");

    let tooltipText = "Descargar con BundleRock";

    switch (state) {
      case "loading":
        iconSpinner.style.display = "block";
        button.classList.add("is-loading");
        tooltipText = customTooltip || "Enviando a BundleRock...";
        break;
      case "success":
        iconSuccess.style.display = "block";
        button.classList.add("is-success");
        tooltipText = customTooltip || "Enviado a BundleRock";
        break;
      case "error":
        iconError.style.display = "block";
        button.classList.add("is-error");
        tooltipText = customTooltip || "Error al enviar";
        break;
      case "idle":
      default:
        iconArrow.style.display = "block";
        tooltipText = "Descargar con BundleRock";
        break;
    }

    tooltip.textContent = tooltipText;
    button.setAttribute("aria-label", tooltipText);
  }

  // Attach host to active document or fullscreen element
  function attachHost() {
    const targetParent = document.fullscreenElement || document.documentElement || document.body;
    if (targetParent && hostElement.parentElement !== targetParent) {
      targetParent.appendChild(hostElement);
    }
  }

  // --- URL Cleaners and Platform Extractors ---

  function cleanUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== "string") return "";
    try {
      const parsed = new URL(rawUrl, window.location.href);
      const trackingParams = [
        "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_name",
        "fbclid", "igshid", "gclid", "msclkid",
        "_hsenc", "_hsmi", "mc_cid", "mc_eid",
        "si", "sender_device", "is_from_webapp", "share_app_id", "ug_source", "_r", "checksum",
        "ref", "ref_source", "ref_src", "ref_sharing", "context",
        "__tn__", "__cft__", "extid", "mibextid",
        "feature", "pp"
      ];
      trackingParams.forEach((param) => parsed.searchParams.delete(param));
      // Remove share tracker on Twitter/X
      if (parsed.hostname.includes("x.com") || parsed.hostname.includes("twitter.com")) {
        parsed.searchParams.delete("s");
        parsed.searchParams.delete("t");
      }
      return parsed.href;
    } catch {
      return rawUrl;
    }
  }

  function resolveTikTok(video) {
    if (window.location.pathname.includes("/video/") || window.location.pathname.includes("/photo/")) {
      return cleanUrl(window.location.href);
    }

    const feedItem = video.closest(
      '[data-e2e="recommend-list-item-container"], [data-e2e="feed-item"], [data-e2e*="item"], [data-e2e*="card"], [class*="ItemContainer"], [class*="DivItemContainer"], [class*="FeedItem"]'
    );

    let candidateLink = null;
    let candidateAuthor = "";
    let candidateId = "";

    if (feedItem) {
      const link = feedItem.querySelector('a[href*="/video/"], a[href*="/photo/"]');
      if (link && link.getAttribute("href")) {
        candidateLink = link.getAttribute("href");
      }
    }

    let curr = video;
    let maxLevels = 15;
    while (curr && curr !== document.body && curr !== document.documentElement && maxLevels > 0) {
      maxLevels--;

      if (!candidateLink) {
        const link = curr.querySelector('a[href*="/video/"], a[href*="/photo/"]');
        if (link && link.getAttribute("href")) {
          candidateLink = link.getAttribute("href");
          break;
        }
      }

      if (!candidateId) {
        const idAttr = curr.id || curr.getAttribute("data-item-id") || curr.getAttribute("data-id") || "";
        const idMatch = idAttr.match(/(?:xgwrapper-\d+-)?(\d{18,20})/);
        if (idMatch) {
          candidateId = idMatch[1];
        } else if (curr.dataset && curr.dataset.itemId) {
          candidateId = curr.dataset.itemId;
        }
      }

      if (!candidateAuthor) {
        const authorEl = curr.querySelector(
          '[data-e2e="video-author-uniqueid"], [data-e2e="video-author-avatar"], a[href^="/@"], a[href*="/@"]'
        );
        if (authorEl) {
          const href = authorEl.getAttribute("href") || "";
          const m = href.match(/\/@([a-zA-Z0-9_.-]+)/);
          if (m) {
            candidateAuthor = m[1];
          } else if (authorEl.textContent && authorEl.textContent.trim()) {
            candidateAuthor = authorEl.textContent.trim().replace(/^@/, "");
          }
        }
      }

      if (curr.parentElement && curr.parentElement.querySelectorAll("video").length > 1) {
        if (!candidateLink) {
          const link = curr.querySelector('a[href*="/video/"], a[href*="/photo/"]');
          if (link && link.getAttribute("href")) candidateLink = link.getAttribute("href");
        }
        break;
      }
      curr = curr.parentElement;
    }

    if (candidateLink) {
      return cleanUrl(new URL(candidateLink, "https://www.tiktok.com").href);
    }

    if (candidateId) {
      if (!candidateAuthor && window.location.pathname.startsWith("/@")) {
        const parts = window.location.pathname.split("/");
        if (parts[1] && parts[1].startsWith("@")) {
          candidateAuthor = parts[1].slice(1);
        }
      }
      if (candidateAuthor) {
        return `https://www.tiktok.com/@${candidateAuthor}/video/${candidateId}`;
      }
      return `https://www.tiktok.com/@video/video/${candidateId}`;
    }

    if (video.currentSrc && !video.currentSrc.startsWith("blob:") && !video.currentSrc.startsWith("data:")) {
      return video.currentSrc;
    }
    return cleanUrl(window.location.href);
  }

  function resolveTwitter(video) {
    const quote = video.closest('[data-testid="quoteTweet"], [data-testid="tweetQuote"]');
    if (quote) {
      const quoteTime = quote.querySelector('a[href*="/status/"] time')?.closest("a") || quote.querySelector('a[href*="/status/"]');
      if (quoteTime && quoteTime.getAttribute("href")) {
        return cleanUrl(new URL(quoteTime.getAttribute("href"), "https://x.com").href);
      }
    }

    const article = video.closest('article, [data-testid="tweet"]');
    if (article) {
      const timeAnchor = article.querySelector('a[href*="/status/"] time')?.closest("a") || article.querySelector('a[href*="/status/"]');
      if (timeAnchor && timeAnchor.getAttribute("href")) {
        return cleanUrl(new URL(timeAnchor.getAttribute("href"), "https://x.com").href);
      }
    }

    if (window.location.pathname.includes("/status/")) {
      return cleanUrl(window.location.href);
    }

    if (video.currentSrc && !video.currentSrc.startsWith("blob:")) {
      return video.currentSrc;
    }
    return cleanUrl(window.location.href);
  }

  function resolveYouTube(video) {
    const pathname = window.location.pathname;

    if (pathname.startsWith("/shorts/")) {
      const match = pathname.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
      if (match) return `https://www.youtube.com/shorts/${match[1]}`;
    }

    if (pathname.startsWith("/watch")) {
      const url = new URL(window.location.href);
      const v = url.searchParams.get("v");
      if (v) return `https://www.youtube.com/watch?v=${v}`;
    }

    if (pathname.startsWith("/embed/")) {
      const match = pathname.match(/\/embed\/([a-zA-Z0-9_-]+)/);
      if (match) return `https://www.youtube.com/watch?v=${match[1]}`;
    }

    const card = video.closest(
      "ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, ytd-reel-item-renderer, ytd-reel-video-renderer, [class*='ytd-reel'], ytd-playlist-video-renderer"
    );
    if (card) {
      const shortLink = card.querySelector('a[href*="/shorts/"]');
      if (shortLink && shortLink.getAttribute("href")) {
        const m = shortLink.getAttribute("href").match(/\/shorts\/([a-zA-Z0-9_-]+)/);
        if (m) return `https://www.youtube.com/shorts/${m[1]}`;
      }
      const watchLink = card.querySelector('a#thumbnail[href*="/watch"], a#video-title[href*="/watch"], a[href*="/watch?v="]');
      if (watchLink && watchLink.getAttribute("href")) {
        const m = (watchLink.getAttribute("href") || "").match(/[?&]v=([a-zA-Z0-9_-]+)/);
        if (m) return `https://www.youtube.com/watch?v=${m[1]}`;
      }
    }

    return cleanUrl(window.location.href);
  }

  function resolveFacebook(video) {
    if (window.location.pathname.includes("/reel/")) {
      return cleanUrl(window.location.href);
    }
    if (window.location.pathname.includes("/watch") && window.location.search && window.location.search.includes("v=")) {
      const url = new URL(window.location.href);
      const v = url.searchParams.get("v");
      if (v) return `https://www.facebook.com/watch/?v=${v}`;
    }

    let curr = video;
    let maxLevels = 15;
    while (curr && curr !== document.body && curr !== document.documentElement && maxLevels > 0) {
      maxLevels--;

      const reelLink = curr.querySelector('a[href*="/reel/"]');
      if (reelLink && reelLink.getAttribute("href")) {
        return cleanUrl(new URL(reelLink.getAttribute("href"), "https://www.facebook.com").href);
      }

      const watchLink = curr.querySelector('a[href*="/watch/"], a[href*="/watch?"], a[href*="/videos/"]');
      if (watchLink && watchLink.getAttribute("href")) {
        return cleanUrl(new URL(watchLink.getAttribute("href"), "https://www.facebook.com").href);
      }

      const postLink = curr.querySelector('a[href*="/posts/"], a[href*="story_fbid="], a[href*="/permalink.php"]');
      if (postLink && postLink.getAttribute("href")) {
        return cleanUrl(new URL(postLink.getAttribute("href"), "https://www.facebook.com").href);
      }

      if (curr.parentElement && curr.parentElement.querySelectorAll("video").length > 1) {
        break;
      }
      curr = curr.parentElement;
    }

    if (video.currentSrc && !video.currentSrc.startsWith("blob:") && !video.currentSrc.startsWith("data:")) {
      return video.currentSrc;
    }
    return cleanUrl(window.location.href);
  }

  // Reddit resolver: STRICTLY NEVER returns packaged-media.redd.it or v.redd.it direct stream links.
  // Resolves to the canonical post comments URL (https://www.reddit.com/r/.../comments/...) where yt-dlp muxes audio and video.
  function resolveReddit(video) {
    // 1. Direct post / comments page
    if (window.location.pathname.includes("/comments/")) {
      return cleanUrl(window.location.href);
    }

    // Helper to extract canonical link from a <shreddit-post> element
    function extractFromShreddit(shreddit) {
      if (!shreddit) return null;
      const permalink =
        shreddit.getAttribute("permalink") ||
        shreddit.getAttribute("content-href") ||
        shreddit.getAttribute("post-url");
      if (permalink && permalink.includes("/comments/")) {
        return cleanUrl(new URL(permalink, "https://www.reddit.com").href);
      }
      const fullLink = shreddit.querySelector(
        'a[slot="full-post-link"], a[slot="title"], a[href*="/comments/"]'
      );
      if (fullLink && fullLink.getAttribute("href") && fullLink.getAttribute("href").includes("/comments/")) {
        return cleanUrl(new URL(fullLink.getAttribute("href"), "https://www.reddit.com").href);
      }
      return null;
    }

    // 2. Upward traversal through light DOM and shadow root hosts
    let curr = video;
    let maxLevels = 20;
    while (curr && curr !== document.body && curr !== document.documentElement && maxLevels > 0) {
      maxLevels--;

      // Check for Modern Reddit: <shreddit-post>
      if (curr.tagName && curr.tagName.toLowerCase() === "shreddit-post") {
        const canonical = extractFromShreddit(curr);
        if (canonical) return canonical;
      }
      if (curr.closest) {
        const found = curr.closest("shreddit-post");
        if (found) {
          const canonical = extractFromShreddit(found);
          if (canonical) return canonical;
        }
      }

      // Check for Classic Reddit post containers
      if (
        curr.matches &&
        (curr.matches('div[data-testid="post-container"]') ||
          curr.matches(".thing") ||
          curr.matches("article") ||
          curr.matches('[id^="t3_"]'))
      ) {
        const link = curr.querySelector(
          'a[data-click-id="body"][href*="/comments/"], a[data-click-id="comments"][href*="/comments/"], a.title[href*="/comments/"], a[href*="/comments/"]'
        );
        if (link && link.getAttribute("href")) {
          return cleanUrl(new URL(link.getAttribute("href"), "https://www.reddit.com").href);
        }
        break; // Stop climbing outside this post container
      }

      // Stop ascending if container wraps multiple posts (avoids capturing post 1 when downloading post 10)
      if (
        curr.parentElement &&
        curr.parentElement.querySelectorAll &&
        curr.parentElement.querySelectorAll('shreddit-post, div[data-testid="post-container"]').length > 1
      ) {
        break;
      }

      // Pierce shadow root boundaries
      const root = curr.getRootNode ? curr.getRootNode() : null;
      if (root && root.host) {
        curr = root.host;
      } else {
        curr = curr.parentElement;
      }
    }

    // 3. Fallback: Check bounding boxes of all posts on screen to find which post contains this video
    const vRect = video.getBoundingClientRect();
    if (vRect.width > 0 && vRect.height > 0) {
      const posts = document.querySelectorAll('shreddit-post, div[data-testid="post-container"], article');
      for (const p of posts) {
        const pRect = p.getBoundingClientRect();
        if (pRect.top <= vRect.top + 50 && pRect.bottom >= vRect.bottom - 50) {
          if (p.tagName && p.tagName.toLowerCase() === "shreddit-post") {
            const canonical = extractFromShreddit(p);
            if (canonical) return canonical;
          }
          const a = p.querySelector('a[slot="full-post-link"], a[href*="/comments/"]');
          if (a && a.getAttribute("href") && a.getAttribute("href").includes("/comments/")) {
            return cleanUrl(new URL(a.getAttribute("href"), "https://www.reddit.com").href);
          }
        }
      }
    }

    // 4. Fallback: Search all <shreddit-post> on page referencing the video's media ID
    const rawSrc = video.currentSrc || video.src || "";
    const mediaMatch = rawSrc.match(/(?:packaged-media\.redd\.it|v\.redd\.it)\/([a-zA-Z0-9]+)/);
    if (mediaMatch && mediaMatch[1]) {
      const mediaId = mediaMatch[1];
      const posts = document.querySelectorAll("shreddit-post");
      for (const p of posts) {
        if (
          p.innerHTML.includes(mediaId) ||
          p.querySelector(`[src*="${mediaId}"], [stream-url*="${mediaId}"]`)
        ) {
          const canonical = extractFromShreddit(p);
          if (canonical) return canonical;
        }
      }

      // If cannot resolve exact canonical comments URL from DOM, return https://v.redd.it/<id>
      // yt-dlp automatically resolves v.redd.it redirects to the exact canonical Reddit post
      return `https://v.redd.it/${mediaId}`;
    }

    // Under no circumstances return a non-post URL like https://www.reddit.com/ (causes yt-dlp failure)
    return cleanUrl(window.location.href);
  }

  function resolveInstagram(video) {
    const article = video.closest("article");
    if (article) {
      const link = article.querySelector('a[href*="/p/"], a[href*="/reel/"]');
      if (link && link.getAttribute("href")) {
        return cleanUrl(new URL(link.getAttribute("href"), "https://www.instagram.com").href);
      }
    }

    if (window.location.pathname.includes("/reel/") || window.location.pathname.includes("/p/")) {
      return cleanUrl(window.location.href);
    }

    return cleanUrl(window.location.href);
  }

  function resolveGeneric(video) {
    if (video.currentSrc && !video.currentSrc.startsWith("blob:") && !video.currentSrc.startsWith("data:")) {
      return cleanUrl(video.currentSrc);
    }
    if (video.src && !video.src.startsWith("blob:") && !video.src.startsWith("data:")) {
      return cleanUrl(video.src);
    }
    const sources = video.querySelectorAll("source");
    for (const s of sources) {
      if (s.src && !s.src.startsWith("blob:") && !s.src.startsWith("data:")) {
        return cleanUrl(s.src);
      }
    }
    return cleanUrl(window.location.href);
  }

  function resolveVideoUrl(video) {
    if (!video) return window.location.href;
    const host = window.location.hostname.toLowerCase();

    if (host.includes("tiktok.com")) return resolveTikTok(video);
    if (host.includes("twitter.com") || host.includes("x.com")) return resolveTwitter(video);
    if (host.includes("youtube.com") || host.includes("youtu.be")) return resolveYouTube(video);
    if (host.includes("facebook.com")) return resolveFacebook(video);
    if (host.includes("reddit.com") || host.includes("redd.it")) return resolveReddit(video);
    if (host.includes("instagram.com")) return resolveInstagram(video);

    return resolveGeneric(video);
  }

  // --- Positioning & Visibility ---

  function updatePosition() {
    if (!currentTargetVideo || !isEnabled) {
      hideButtonNow();
      return;
    }

    // Video must be connected to DOM
    if (!currentTargetVideo.isConnected) {
      hideButtonNow();
      return;
    }

    const rect = currentTargetVideo.getBoundingClientRect();

    // Check minimum dimensions and viewport visibility
    if (rect.width < 120 || rect.height < 80) {
      hideButtonNow();
      return;
    }

    const inViewport =
      rect.bottom > 20 &&
      rect.top < window.innerHeight - 20 &&
      rect.right > 20 &&
      rect.left < window.innerWidth - 20;

    if (!inViewport) {
      hideButtonNow();
      return;
    }

    attachHost();

    const btnWidth = 36;
    const btnHeight = 36;

    // Compute coordinate for top-right inside video with 10px margin
    let left = rect.right - btnWidth - 10;
    let top = rect.top + 10;

    // Keep clamped inside viewport
    if (left < 8) left = 8;
    if (left + btnWidth > window.innerWidth - 8) {
      left = window.innerWidth - btnWidth - 8;
    }
    if (top < 8) top = 8;
    if (top + btnHeight > window.innerHeight - 8) {
      top = window.innerHeight - btnHeight - 8;
    }

    if (left < 210) {
      container.classList.add("tooltip-right");
    } else {
      container.classList.remove("tooltip-right");
    }

    container.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    container.classList.add("is-visible");
  }

  function showButtonForVideo(video) {
    if (!isEnabled || isBusy) return;
    currentTargetVideo = video;
    clearHideTimeout();
    updatePosition();
  }

  function scheduleHideButton() {
    if (isBusy || isHoveringButton) return;
    clearHideTimeout();
    hideTimeoutId = setTimeout(() => {
      if (!isHoveringButton && !isHoveringVideo && !isBusy) {
        hideButtonNow();
      }
    }, 1400);
  }

  function clearHideTimeout() {
    if (hideTimeoutId) {
      clearTimeout(hideTimeoutId);
      hideTimeoutId = null;
    }
  }

  function hideButtonNow() {
    clearHideTimeout();
    container.classList.remove("is-visible");
    currentTargetVideo = null;
    if (!isBusy) {
      setButtonState("idle");
    }
  }

  // --- Event Listeners & Hover Tracking ---

  container.addEventListener("mouseenter", () => {
    isHoveringButton = true;
    clearHideTimeout();
  });

  container.addEventListener("mouseleave", () => {
    isHoveringButton = false;
    scheduleHideButton();
  });

  button.addEventListener("mouseenter", () => {
    isHoveringButton = true;
    clearHideTimeout();
  });

  button.addEventListener("mouseleave", () => {
    isHoveringButton = false;
    scheduleHideButton();
  });

  // Track context menu targets for exact right-click post resolution
  document.addEventListener(
    "contextmenu",
    (e) => {
      lastContextMenuTarget = e.target;
    },
    true
  );

  // Prevent underlying video player interception on click or mouse events
  const stopProp = (e) => {
    e.stopPropagation();
    e.stopImmediatePropagation();
  };

  button.addEventListener("pointerdown", stopProp);
  button.addEventListener("pointerup", stopProp);
  button.addEventListener("mousedown", stopProp);
  button.addEventListener("mouseup", stopProp);
  button.addEventListener("dblclick", (e) => {
    e.preventDefault();
    stopProp(e);
  });
  button.addEventListener("contextmenu", stopProp);

  // Launches custom protocol bundlerock:// (Roblox style)
  function launchProtocol(protocolUrl) {
    try {
      const a = document.createElement("a");
      a.href = protocolUrl;
      a.style.display = "none";
      (document.body || document.documentElement).appendChild(a);
      a.click();
      setTimeout(() => {
        try {
          a.remove();
        } catch (e) {}
      }, 2000);
    } catch (e) {
      window.location.assign(protocolUrl);
    }
  }

  // Handle messages from background script
  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "open_protocol" && request.protocolUrl) {
        launchProtocol(request.protocolUrl);
        sendResponse({ handled: true });
        return true;
      }

      if (request.action === "get_context_target_url") {
        let resolved = null;
        if (lastContextMenuTarget) {
          const v =
            (lastContextMenuTarget instanceof HTMLVideoElement ? lastContextMenuTarget : null) ||
            lastContextMenuTarget.closest("video") ||
            (lastContextMenuTarget.querySelector && lastContextMenuTarget.querySelector("video")) ||
            (lastContextMenuTarget.shadowRoot && lastContextMenuTarget.shadowRoot.querySelector("video")) ||
            currentTargetVideo;
          if (v) {
            resolved = resolveVideoUrl(v);
          }
        }
        if (!resolved && currentTargetVideo) {
          resolved = resolveVideoUrl(currentTargetVideo);
        }
        sendResponse({ resolvedUrl: resolved });
        return true;
      }
    });
  }

  button.addEventListener("click", async (e) => {
    e.preventDefault();
    stopProp(e);

    if (isBusy || !currentTargetVideo) return;

    // Trigger cyan pulse ring animation
    button.classList.remove("is-pulsing");
    void button.offsetWidth;
    button.classList.add("is-pulsing");
    setTimeout(() => {
      button.classList.remove("is-pulsing");
    }, 600);

    isBusy = true;

    const resolvedUrl = resolveVideoUrl(currentTargetVideo);
    setButtonState("loading", "Enviando a BundleRock...");

    try {
      chrome.runtime.sendMessage(
        {
          action: "download",
          url: resolvedUrl,
          page_url: window.location.href
        },
        (response) => {
          if (chrome.runtime.lastError) {
            setButtonState("error", "Error de extensión");
            setTimeout(() => {
              isBusy = false;
              setButtonState("idle");
              if (!isHoveringButton) scheduleHideButton();
            }, 3000);
            return;
          }

          if (response && response.success) {
            if (response.protocolFallback && response.protocolUrl) {
              launchProtocol(response.protocolUrl);
              setButtonState("success", "Iniciando BundleRock...");
            } else {
              setButtonState("success", "Enviado a BundleRock");
            }
            setTimeout(() => {
              isBusy = false;
              setButtonState("idle");
              if (!isHoveringButton) scheduleHideButton();
            }, 2500);
          } else {
            const msg = response?.error || "BundleRock no responde";
            setButtonState("error", msg);
            setTimeout(() => {
              isBusy = false;
              setButtonState("idle");
              if (!isHoveringButton) scheduleHideButton();
            }, 3000);
          }
        }
      );
    } catch (err) {
      setButtonState("error", "No se pudo conectar");
      setTimeout(() => {
        isBusy = false;
        setButtonState("idle");
        if (!isHoveringButton) scheduleHideButton();
      }, 3000);
    }
  });

  // Track cursor movement across video players (including custom elements and transparent overlays)
  function handlePointerMove(e) {
    if (!isEnabled || isBusy) return;

    // Fast path: if pointer is within floating host or container, retain button
    const path = e.composedPath ? e.composedPath() : [];
    if (path.includes(hostElement) || path.includes(container)) {
      isHoveringButton = true;
      clearHideTimeout();
      return;
    }

    // Throttle hit-testing
    const now = Date.now();
    if (now - lastMouseMoveTime < 50) return;
    lastMouseMoveTime = now;

    // Detect video element under coordinates (piercing overlays and web component hosts)
    let foundVideo = null;
    if (e.target instanceof HTMLVideoElement) {
      foundVideo = e.target;
    } else {
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      for (const el of elements) {
        if (el instanceof HTMLVideoElement || el.tagName === "VIDEO") {
          foundVideo = el;
          break;
        }
        if (el.querySelector) {
          const v = el.querySelector("video");
          if (v) {
            foundVideo = v;
            break;
          }
        }
        if (el.shadowRoot && el.shadowRoot.querySelector) {
          const v = el.shadowRoot.querySelector("video");
          if (v) {
            foundVideo = v;
            break;
          }
        }
      }
    }

    if (foundVideo) {
      isHoveringVideo = true;
      showButtonForVideo(foundVideo);
    } else {
      isHoveringVideo = false;
      if (currentTargetVideo && !isHoveringButton) {
        scheduleHideButton();
      }
    }
  }

  document.addEventListener("pointermove", handlePointerMove, { passive: true });
  document.addEventListener("mousemove", handlePointerMove, { passive: true });

  document.addEventListener("mouseleave", () => {
    isHoveringVideo = false;
    isHoveringButton = false;
    scheduleHideButton();
  });

  // Native video event listeners (capture phase)
  document.addEventListener(
    "play",
    (e) => {
      if (!isEnabled || isBusy) return;
      if (e.target instanceof HTMLVideoElement) {
        showButtonForVideo(e.target);
        scheduleHideButton();
      }
    },
    true
  );

  // Position synchronization on scroll and resize
  function onScrollOrResize() {
    if (!currentTargetVideo || !container.classList.contains("is-visible")) return;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = requestAnimationFrame(() => {
      updatePosition();
    });
  }

  window.addEventListener("scroll", onScrollOrResize, { passive: true, capture: true });
  window.addEventListener("resize", onScrollOrResize, { passive: true });

  // Handle Fullscreen transitions
  const onFullscreenTransition = () => {
    attachHost();
    if (currentTargetVideo) {
      updatePosition();
    }
  };
  document.addEventListener("fullscreenchange", onFullscreenTransition);
  document.addEventListener("webkitfullscreenchange", onFullscreenTransition);

  // Initial attach
  if (document.body || document.documentElement) {
    attachHost();
  } else {
    document.addEventListener("DOMContentLoaded", attachHost);
  }
})();
