// For Production
const API_BASE_URL = "https://rq6ypa7pyw.ap-south-1.awsapprunner.com";

// For Development
// const API_BASE_URL = "http://localhost:8080";

// Store for active meetings
let activeMeetings = {};

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log("Cortex AI Extension installed");
  chrome.storage.local.set({
    apiUrl: API_BASE_URL,
    isRecording: false,
    activeMeetingId: null,
    captions: [],
  });
});

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "MEETING_DETECTED":
      handleMeetingDetected(message.data, sender.tab?.id);
      break;

    case "MEETING_ENDED":
      handleMeetingEnded(message.data);
      break;

    case "CAPTION_RECEIVED":
      handleCaptionReceived(message.data);
      break;

    case "GET_STATUS":
      getStatus().then(sendResponse);
      return true;

    case "START_RECORDING":
      startRecording(message.data).then(sendResponse);
      return true;

    case "STOP_RECORDING":
      stopRecording().then(sendResponse);
      return true;

    case "SET_API_URL":
      chrome.storage.local.set({ apiUrl: message.data.url });
      sendResponse({ success: true });
      break;
  }
});

// Handle meeting detection
async function handleMeetingDetected(data, tabId) {
  console.log("Meeting detected:", data);

  const { platform, meetingId, meetingTitle } = data;

  // Store meeting info
  activeMeetings[meetingId] = {
    platform,
    meetingId,
    meetingTitle,
    tabId,
    startTime: Date.now(),
    captions: [],
  };

  // Update extension icon
  chrome.action.setBadgeText({ text: "LIVE", tabId });
  chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });

  // Notify popup
  chrome.runtime.sendMessage({
    type: "MEETING_STATUS_CHANGED",
    data: { isInMeeting: true, meeting: activeMeetings[meetingId] },
  });
}

// Handle meeting ended
async function handleMeetingEnded(data) {
  console.log("Meeting ended:", data);

  const { meetingId } = data;
  const meeting = activeMeetings[meetingId];

  if (meeting) {
    // Clear badge
    chrome.action.setBadgeText({ text: "", tabId: meeting.tabId });

    // If recording was active, stop it
    const { isRecording } = await chrome.storage.local.get("isRecording");
    if (isRecording) {
      await stopRecording();
    }

    // Clean up
    delete activeMeetings[meetingId];

    // Notify popup
    chrome.runtime.sendMessage({
      type: "MEETING_STATUS_CHANGED",
      data: { isInMeeting: false },
    });
  }
}

// Handle caption received
async function handleCaptionReceived(data) {
  const { meetingId, text, speaker, timestamp } = data;

  // Store caption locally
  const { captions = [] } = await chrome.storage.local.get("captions");
  captions.push({ meetingId, text, speaker, timestamp });
  await chrome.storage.local.set({ captions });

  // If recording is active, send to API
  const { isRecording, activeMeetingId, apiUrl } = await chrome.storage.local.get([
    "isRecording",
    "activeMeetingId",
    "apiUrl",
  ]);

  if (isRecording && activeMeetingId) {
    try {
      const token = await getAuthToken();
      if (token) {
        await fetch(`${apiUrl}/integrations/bot/captions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            meetingId: activeMeetingId,
            text: `${speaker ? speaker + ": " : ""}${text}`,
            timestamp,
          }),
        });
      }
    } catch (error) {
      console.error("Failed to send caption:", error);
    }
  }
}

// Get extension status
async function getStatus() {
  const { isRecording, activeMeetingId, captions, apiUrl } =
    await chrome.storage.local.get([
      "isRecording",
      "activeMeetingId",
      "captions",
      "apiUrl",
    ]);

  const meetings = Object.values(activeMeetings);
  const isInMeeting = meetings.length > 0;

  return {
    isRecording,
    isInMeeting,
    activeMeetingId,
    currentMeeting: meetings[0] || null,
    captionCount: captions?.length || 0,
    apiUrl,
  };
}

// Start recording
async function startRecording(data) {
  try {
    const { meetingTitle, apiUrl } = await chrome.storage.local.get([
      "meetingTitle",
      "apiUrl",
    ]);
    const token = await getAuthToken();

    if (!token) {
      return { success: false, error: "Not authenticated" };
    }

    // Start meeting via API
    const response = await fetch(`${apiUrl}/user/meetings/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ title: meetingTitle || data.title }),
    });

    const result = await response.json();

    if (result.success) {
      await chrome.storage.local.set({
        isRecording: true,
        activeMeetingId: result.data.meeting.meetingId,
        captions: [],
      });

      return { success: true, meeting: result.data.meeting };
    } else {
      return { success: false, error: result.message };
    }
  } catch (error) {
    console.error("Failed to start recording:", error);
    return { success: false, error: error.message };
  }
}

// Stop recording
async function stopRecording() {
  try {
    const { activeMeetingId, apiUrl } = await chrome.storage.local.get([
      "activeMeetingId",
      "apiUrl",
    ]);
    const token = await getAuthToken();

    if (!token || !activeMeetingId) {
      return { success: false, error: "No active recording" };
    }

    // End meeting via API
    const response = await fetch(
      `${apiUrl}/user/meetings/${activeMeetingId}/end`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const result = await response.json();

    if (result.success) {
      await chrome.storage.local.set({
        isRecording: false,
        activeMeetingId: null,
        captions: [],
      });

      return { success: true, meeting: result.data.meeting };
    } else {
      return { success: false, error: result.message };
    }
  } catch (error) {
    console.error("Failed to stop recording:", error);
    return { success: false, error: error.message };
  }
}

// Get auth token from storage
async function getAuthToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get("authToken", (result) => {
      resolve(result.authToken || null);
    });
  });
}

// Handle tab updates to detect meeting changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    const platform = detectPlatform(tab.url);
    if (platform) {
      // Inject content script if needed
      chrome.scripting.executeScript({
        target: { tabId },
        files: ["injected.js"],
      });
    }
  }
});

// Detect meeting platform from URL
function detectPlatform(url) {
  if (url.includes("zoom.us")) return "zoom";
  if (url.includes("meet.google.com")) return "google-meet";
  if (url.includes("teams.microsoft.com")) return "teams";
  return null;
}
