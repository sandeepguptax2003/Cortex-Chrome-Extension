// Cortex AI Extension — Service Worker

const PROD_API_URL = "https://rq6ypa7pyw.ap-south-1.awsapprunner.com";
const DEV_API_URL  = "http://localhost:8080";

// In-memory map of detected meetings (keyed by meetingId)
let activeMeetings = {};

// ─── Init ────────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    apiUrl: PROD_API_URL,
    isRecording: false,
    activeMeetingId: null,
    captions: [],
    scheduledMeetings: [],
  });
});

// ─── Message Router ──────────────────────────────────────────────────────────

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

    case "SCHEDULE_MEETING":
      scheduleMeeting(message.data).then(sendResponse);
      return true;

    case "GET_SCHEDULES":
      getSchedules().then(sendResponse);
      return true;

    case "CANCEL_SCHEDULE":
      cancelSchedule(message.data.alarmName).then(sendResponse);
      return true;
  }
});

// ─── Meeting Detection ───────────────────────────────────────────────────────

async function handleMeetingDetected(data, tabId) {
  const { platform, meetingId, meetingTitle } = data;

  activeMeetings[meetingId] = { platform, meetingId, meetingTitle, tabId, startTime: Date.now(), captions: [] };

  chrome.action.setBadgeText({ text: "LIVE", tabId });
  chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });

  // Auto-start recording if this tab was opened by a scheduled meeting
  const { autoRecordPending } = await chrome.storage.local.get("autoRecordPending");
  if (autoRecordPending) {
    await chrome.storage.local.remove("autoRecordPending");
    const result = await startRecording({ title: meetingTitle || "Scheduled Meeting", autoStarted: true });
    if (!result.success) {
      console.warn("Auto-start recording failed:", result.error);
    }
  }

  chrome.runtime.sendMessage({ type: "MEETING_STATUS_CHANGED", data: { isInMeeting: true, meeting: activeMeetings[meetingId] } }).catch(() => {});
}

async function handleMeetingEnded(data) {
  const { meetingId } = data;
  const meeting = activeMeetings[meetingId];

  if (meeting) {
    chrome.action.setBadgeText({ text: "", tabId: meeting.tabId });

    const { isRecording } = await chrome.storage.local.get("isRecording");
    if (isRecording) await stopRecording();

    delete activeMeetings[meetingId];
    chrome.runtime.sendMessage({ type: "MEETING_STATUS_CHANGED", data: { isInMeeting: false } }).catch(() => {});
  }
}

// ─── Caption Handling ────────────────────────────────────────────────────────

async function handleCaptionReceived(data) {
  const { meetingId, text, speaker, timestamp } = data;

  const { captions = [] } = await chrome.storage.local.get("captions");
  captions.push({ meetingId, text, speaker, timestamp });
  await chrome.storage.local.set({ captions });

  const { isRecording, activeMeetingId, apiUrl } = await chrome.storage.local.get(["isRecording", "activeMeetingId", "apiUrl"]);

  if (isRecording && activeMeetingId) {
    const token = await getAuthToken();
    if (token) {
      fetch(`${apiUrl}/integrations/bot/captions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ meetingId: activeMeetingId, text: `${speaker ? speaker + ": " : ""}${text}`, timestamp }),
      }).catch((err) => console.error("Caption send failed:", err));
    }
  }
}

// ─── Status ──────────────────────────────────────────────────────────────────

async function getStatus() {
  const { isRecording, activeMeetingId, captions, apiUrl } = await chrome.storage.local.get([
    "isRecording", "activeMeetingId", "captions", "apiUrl",
  ]);

  const meetings = Object.values(activeMeetings);
  return {
    isRecording,
    isInMeeting: meetings.length > 0,
    activeMeetingId,
    currentMeeting: meetings[0] || null,
    captionCount: captions?.length || 0,
    apiUrl,
  };
}

// ─── Start Recording ─────────────────────────────────────────────────────────

async function startRecording(data) {
  try {
    const { apiUrl } = await chrome.storage.local.get("apiUrl");
    const token = await getAuthToken();

    if (!token) return { success: false, error: "Not authenticated. Paste your token in Settings." };

    const response = await fetch(`${apiUrl}/user/meetings/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: data?.title || "Meeting" }),
    });

    const result = await response.json();

    if (result.success) {
      await chrome.storage.local.set({
        isRecording: true,
        activeMeetingId: result.data.meeting.meetingId,
        captions: [],
      });
      return { success: true, meeting: result.data.meeting };
    }
    return { success: false, error: result.message };
  } catch (err) {
    console.error("startRecording error:", err);
    return { success: false, error: err.message };
  }
}

// ─── Stop Recording ──────────────────────────────────────────────────────────

async function stopRecording() {
  try {
    const { activeMeetingId, apiUrl } = await chrome.storage.local.get(["activeMeetingId", "apiUrl"]);
    const token = await getAuthToken();

    if (!token || !activeMeetingId) return { success: false, error: "No active recording" };

    const response = await fetch(`${apiUrl}/user/meetings/${activeMeetingId}/end`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    const result = await response.json();

    if (result.success) {
      await chrome.storage.local.set({ isRecording: false, activeMeetingId: null, captions: [] });
      return { success: true, meeting: result.data.meeting };
    }
    return { success: false, error: result.message };
  } catch (err) {
    console.error("stopRecording error:", err);
    return { success: false, error: err.message };
  }
}

// ─── Auth Token ──────────────────────────────────────────────────────────────

async function getAuthToken() {
  const { authToken } = await chrome.storage.local.get("authToken");
  return authToken || null;
}

// ─── Auto-Join Scheduler ─────────────────────────────────────────────────────

async function scheduleMeeting(data) {
  try {
    const { meetingUrl, title, scheduledAt } = data;
    const fireTime = new Date(scheduledAt).getTime();

    if (fireTime <= Date.now()) {
      return { success: false, error: "Scheduled time must be in the future" };
    }

    const alarmName = `scheduled-meeting-${Date.now()}`;

    // Create a Chrome alarm at the scheduled time
    chrome.alarms.create(alarmName, { when: fireTime });

    // Store schedule entry
    const { scheduledMeetings = [] } = await chrome.storage.local.get("scheduledMeetings");
    scheduledMeetings.push({ alarmName, meetingUrl, title, scheduledAt });
    await chrome.storage.local.set({ scheduledMeetings });

    return { success: true, alarmName };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function getSchedules() {
  const { scheduledMeetings = [] } = await chrome.storage.local.get("scheduledMeetings");
  return scheduledMeetings;
}

async function cancelSchedule(alarmName) {
  try {
    chrome.alarms.clear(alarmName);
    const { scheduledMeetings = [] } = await chrome.storage.local.get("scheduledMeetings");
    await chrome.storage.local.set({
      scheduledMeetings: scheduledMeetings.filter((s) => s.alarmName !== alarmName),
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// When the alarm fires → open the meeting tab, mark auto-record pending
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith("scheduled-meeting-")) return;

  const { scheduledMeetings = [] } = await chrome.storage.local.get("scheduledMeetings");
  const schedule = scheduledMeetings.find((s) => s.alarmName === alarm.name);

  if (!schedule) return;

  // Remove from list
  await chrome.storage.local.set({
    scheduledMeetings: scheduledMeetings.filter((s) => s.alarmName !== alarm.name),
    autoRecordPending: true,
  });

  // Open the meeting tab — content script will detect meeting and auto-start recording
  chrome.tabs.create({ url: schedule.meetingUrl, active: true });
});

// ─── Tab Update (platform detection only — no injected.js needed) ────────────

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    const platform = detectPlatform(tab.url);
    if (platform) {
      // Content script is already injected via manifest content_scripts declaration.
      // Badge update to show the extension is active on this tab.
      chrome.action.setBadgeText({ text: "ON", tabId });
      chrome.action.setBadgeBackgroundColor({ color: "#7c3aed", tabId });
    }
  }
});

function detectPlatform(url) {
  if (url.includes("zoom.us")) return "zoom";
  if (url.includes("meet.google.com")) return "google-meet";
  if (url.includes("teams.microsoft.com")) return "teams";
  return null;
}
