// Cortex AI Chrome Extension - Content Script
// Injected into meeting pages to capture captions

(function () {
  "use strict";

  // Platform detection
  const platform = detectPlatform();
  if (!platform) return;

  console.log("[Cortex AI] Content script loaded for", platform);

  // State
  let isCapturing = false;
  let captionObserver = null;
  let meetingId = null;
  let meetingTitle = null;

  // Initialize
  function init() {
    meetingId = extractMeetingId();
    meetingTitle = extractMeetingTitle();

    // Notify background script about meeting
    chrome.runtime.sendMessage({
      type: "MEETING_DETECTED",
      data: {
        platform,
        meetingId,
        meetingTitle,
        url: window.location.href,
      },
    });

    // Start caption capture
    startCaptionCapture();

    // Listen for page unload
    window.addEventListener("beforeunload", () => {
      chrome.runtime.sendMessage({
        type: "MEETING_ENDED",
        data: { meetingId },
      });
    });
  }

  // Detect platform from URL
  function detectPlatform() {
    const url = window.location.href;
    if (url.includes("zoom.us")) return "zoom";
    if (url.includes("meet.google.com")) return "google-meet";
    if (url.includes("teams.microsoft.com")) return "teams";
    return null;
  }

  // Extract meeting ID from URL
  function extractMeetingId() {
    const url = window.location.href;
    switch (platform) {
      case "zoom":
        const zoomMatch = url.match(/\/j\/(\d+)/);
        return zoomMatch ? zoomMatch[1] : "unknown";
      case "google-meet":
        const meetMatch = url.match(/\/([a-z]{3}-[a-z]{4}-[a-z]{3})/);
        return meetMatch ? meetMatch[1] : "unknown";
      case "teams":
        return url.split("?")[0].split("/").pop() || "unknown";
      default:
        return "unknown";
    }
  }

  // Extract meeting title
  function extractMeetingTitle() {
    // Try to get title from page
    const titleElement = document.querySelector("title");
    if (titleElement) {
      return titleElement.textContent.replace(" - Zoom", "").trim();
    }
    return null;
  }

  // Start caption capture based on platform
  function startCaptionCapture() {
    if (isCapturing) return;
    isCapturing = true;

    console.log("[Cortex AI] Starting caption capture for", platform);

    switch (platform) {
      case "zoom":
        captureZoomCaptions();
        break;
      case "google-meet":
        captureGoogleMeetCaptions();
        break;
      case "teams":
        captureTeamsCaptions();
        break;
    }
  }

  // Capture Zoom captions
  function captureZoomCaptions() {
    // Zoom uses a live transcript panel
    const findTranscriptPanel = () => {
      // Try multiple selectors for different Zoom versions
      const selectors = [
        '[role="log"]',
        '.transcript-panel',
        '.live-transcript',
        '[class*="transcript"]',
        '[class*="caption"]',
      ];

      for (const selector of selectors) {
        const panel = document.querySelector(selector);
        if (panel) return panel;
      }
      return null;
    };

    const processCaption = (element) => {
      const text = element.textContent?.trim();
      if (!text) return;

      // Extract speaker name if present
      let speaker = null;
      let captionText = text;

      const speakerMatch = text.match(/^([^:]+):\s*(.+)$/);
      if (speakerMatch) {
        speaker = speakerMatch[1].trim();
        captionText = speakerMatch[2].trim();
      }

      // Send to background script
      chrome.runtime.sendMessage({
        type: "CAPTION_RECEIVED",
        data: {
          meetingId,
          text: captionText,
          speaker,
          timestamp: Date.now(),
        },
      });
    };

    // Set up observer
    const transcriptPanel = findTranscriptPanel();
    if (transcriptPanel) {
      captionObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              processCaption(node);
            }
          });
        });
      });

      captionObserver.observe(transcriptPanel, {
        childList: true,
        subtree: true,
      });
    }

    // Also poll for new captions as fallback
    setInterval(() => {
      const captions = document.querySelectorAll(
        '[role="log"] > div, .transcript-panel > div, .live-transcript > div'
      );
      captions.forEach((caption) => {
        if (!caption.dataset.cortexProcessed) {
          caption.dataset.cortexProcessed = "true";
          processCaption(caption);
        }
      });
    }, 1000);
  }

  // Capture Google Meet captions
  function captureGoogleMeetCaptions() {
    // Google Meet captions appear in a specific container
    const findCaptionContainer = () => {
      const selectors = [
        '[data-caption-id]',
        '.a4cQT',
        '.VfPpkd-gIZMF',
        '[jsname="tgaKEf"]',
        '.caption-window',
      ];

      for (const selector of selectors) {
        const container = document.querySelector(selector);
        if (container) return container;
      }
      return null;
    };

    const processCaption = (element) => {
      const text = element.textContent?.trim();
      if (!text) return;

      // Google Meet includes speaker name
      let speaker = null;
      let captionText = text;

      // Try to find speaker element
      const speakerElement = element.querySelector(
        '.ZjFb7c, [jsname="Fa7yJd"]'
      );
      if (speakerElement) {
        speaker = speakerElement.textContent.trim();
      }

      // Get caption text
      const textElement = element.querySelector('.bPsqDc, [jsname="YSxPCd"]');
      if (textElement) {
        captionText = textElement.textContent.trim();
      }

      chrome.runtime.sendMessage({
        type: "CAPTION_RECEIVED",
        data: {
          meetingId,
          text: captionText,
          speaker,
          timestamp: Date.now(),
        },
      });
    };

    // Set up observer
    const captionContainer = findCaptionContainer();
    if (captionContainer) {
      captionObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              processCaption(node);
            }
          });
        });
      });

      captionObserver.observe(captionContainer, {
        childList: true,
        subtree: true,
      });
    }

    // Fallback polling
    setInterval(() => {
      const captions = document.querySelectorAll(
        '[data-caption-id], .a4cQT > div'
      );
      captions.forEach((caption) => {
        if (!caption.dataset.cortexProcessed) {
          caption.dataset.cortexProcessed = "true";
          processCaption(caption);
        }
      });
    }, 1000);
  }

  // Capture Teams captions
  function captureTeamsCaptions() {
    // Teams captions are in a transcript panel
    const findTranscriptContainer = () => {
      const selectors = [
        '[data-tid="closed-captions-container"]',
        '.ts-captions-container',
        '.ui-chat__list',
        '[role="log"]',
      ];

      for (const selector of selectors) {
        const container = document.querySelector(selector);
        if (container) return container;
      }
      return null;
    };

    const processCaption = (element) => {
      const text = element.textContent?.trim();
      if (!text) return;

      // Extract speaker from Teams format
      let speaker = null;
      let captionText = text;

      const speakerMatch = text.match(/^([^:]+):\s*(.+)$/);
      if (speakerMatch) {
        speaker = speakerMatch[1].trim();
        captionText = speakerMatch[2].trim();
      }

      chrome.runtime.sendMessage({
        type: "CAPTION_RECEIVED",
        data: {
          meetingId,
          text: captionText,
          speaker,
          timestamp: Date.now(),
        },
      });
    };

    // Set up observer
    const transcriptContainer = findTranscriptContainer();
    if (transcriptContainer) {
      captionObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              processCaption(node);
            }
          });
        });
      });

      captionObserver.observe(transcriptContainer, {
        childList: true,
        subtree: true,
      });
    }

    // Fallback polling
    setInterval(() => {
      const captions = document.querySelectorAll(
        '.ui-chat__item, .ts-message, [data-tid="messageBody"]'
      );
      captions.forEach((caption) => {
        if (!caption.dataset.cortexProcessed) {
          caption.dataset.cortexProcessed = "true";
          processCaption(caption);
        }
      });
    }, 1000);
  }

  // Initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
