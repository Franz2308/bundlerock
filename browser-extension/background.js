// BundleRock Background Service Worker (Manifest V3)

const DEFAULT_PORT = 18200;

// Register context menu items on install or startup
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "bundlerock-download",
      title: "Descargar con BundleRock",
      contexts: ["link", "image", "video", "audio", "page"]
    });
  });
});

// Helper to get configuration
async function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      {
        port: DEFAULT_PORT,
        showSuccessNotification: false,
        showErrorNotification: true
      },
      (items) => {
        resolve(items);
      }
    );
  });
}

// Dispatches custom protocol navigation to trigger browser prompt (Roblox style)
function triggerProtocolInTab(tabId, protocolUrl) {
  if (!tabId) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]?.id) {
        triggerProtocolInTab(tabs[0].id, protocolUrl);
      }
    });
    return;
  }

  chrome.tabs.sendMessage(tabId, { action: "open_protocol", protocolUrl }, (response) => {
    if (chrome.runtime.lastError || !response?.handled) {
      chrome.tabs.update(tabId, { url: protocolUrl }).catch(() => {});
    }
  });
}

// Sanitizes Reddit URLs: never returns packaged-media or feed URLs; ensures yt-dlp receives canonical post or v.redd.it redirect
function sanitizeRedditUrl(url, pageUrl) {
  if (!url) return url;

  // If already canonical post URL
  if (url.includes("/comments/")) return url;

  // If packaged-media or v.redd.it stream
  if (url.includes("packaged-media.redd.it") || url.includes("v.redd.it")) {
    // If pageUrl is an actual post comments page, use pageUrl
    if (pageUrl && pageUrl.includes("/comments/")) {
      return pageUrl;
    }

    // Extract media ID from packaged-media or v.redd.it
    const m = url.match(/(?:packaged-media\.redd\.it|v\.redd\.it)\/([a-zA-Z0-9]+)/);
    if (m && m[1]) {
      // https://v.redd.it/<id> HTTP-redirects cleanly to the canonical post URL in yt-dlp
      return `https://v.redd.it/${m[1]}`;
    }
  }

  return url;
}

// Dispatches a download request to BundleRock desktop app
async function dispatchDownload(targetUrl, pageUrl, tabId = null, fromContextMenu = false) {
  if (!targetUrl || targetUrl.startsWith("chrome://") || targetUrl.startsWith("edge://")) {
    return { success: false, error: "URL inválida o no soportada." };
  }

  let finalUrl = targetUrl;

  // Reddit fix: Never send raw fragmented streams or feed URLs to BundleRock
  finalUrl = sanitizeRedditUrl(finalUrl, pageUrl);

  if (finalUrl.startsWith("blob:") || finalUrl.startsWith("data:")) {
    if (pageUrl && !pageUrl.startsWith("blob:") && !pageUrl.startsWith("data:")) {
      finalUrl = pageUrl;
    } else {
      return { success: false, error: "No se puede descargar un objeto blob o data directamente sin URL de página." };
    }
  }

  const config = await getConfig();
  const endpoint = `http://127.0.0.1:${config.port}/api/download`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: finalUrl,
        page_url: pageUrl || null
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      if (config.showSuccessNotification) {
        chrome.notifications.create({
          type: "basic",
          iconUrl: "icons/icon48.png",
          title: "BundleRock",
          message: "Enlace enviado a BundleRock."
        });
      }
      return { success: true };
    } else {
      const errText = await response.text();
      console.warn("[BundleRock] Server returned error:", response.status, errText);
      return { success: false, error: `Error del servidor (${response.status})` };
    }
  } catch (err) {
    // BundleRock desktop is closed. Fallback to Windows custom protocol bundlerock://
    console.info("[BundleRock] Local server unreachable. Launching via bundlerock:// protocol...");
    const protocolUrl = `bundlerock://download?url=${encodeURIComponent(finalUrl)}`;

    // If triggered from context menu, trigger protocol in tab directly
    // If triggered from content script message, return fallback info so content script launches it ONCE (avoids duplicate execution)
    if (fromContextMenu && tabId) {
      triggerProtocolInTab(tabId, protocolUrl);
    }

    return {
      success: true,
      protocolFallback: true,
      protocolUrl: protocolUrl
    };
  }
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "bundlerock-download") return;

  let targetUrl = info.linkUrl || info.srcUrl || info.pageUrl;
  const pageUrl = info.pageUrl || tab?.url || null;
  const tabId = tab?.id || null;

  // On Reddit, ask content script to resolve the exact post canonical URL of the right-clicked element
  if (tabId && (tab?.url?.includes("reddit.com") || targetUrl?.includes("redd.it"))) {
    try {
      const resolvedFromContent = await new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, { action: "get_context_target_url" }, (res) => {
          if (chrome.runtime.lastError || !res?.resolvedUrl) {
            resolve(null);
          } else {
            resolve(res.resolvedUrl);
          }
        });
      });
      if (resolvedFromContent) {
        targetUrl = resolvedFromContent;
      }
    } catch (e) {
      // Fallback to sanitization
    }
  }

  await dispatchDownload(targetUrl, pageUrl, tabId, true);
});

// Handle messages from content script floating download button
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "download") {
    const pageUrl = request.page_url || sender.tab?.url || sender.url || null;
    const tabId = sender.tab?.id || null;
    dispatchDownload(request.url, pageUrl, tabId, false)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ success: false, error: err.message || "Error desconocido" }));
    return true; // Keep message channel open for async response
  }
});
