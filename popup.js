// Cortex AI Chrome Extension - Popup Script
// Handles UI interactions and communication with background script

document.addEventListener("DOMContentLoaded", async () => {
  // DOM Elements
  const statusBadge = document.getElementById("statusBadge");
  const statusText = statusBadge.querySelector(".status-text");
  const statusDot = statusBadge.querySelector(".status-dot");

  const notInMeeting = document.getElementById("notInMeeting");
  const inMeeting = document.getElementById("inMeeting");
  const recordingActive = document.getElementById("recordingActive");

  const platformBadge = document.getElementById("platformBadge");
  const meetingTitle = document.getElementById("meetingTitle");
  const meetingId = document.getElementById("meetingId");

  const recordBtn = document.getElementById("recordBtn");
  const stopBtn = document.getElementById("stopBtn");

  const captionCount = document.getElementById("captionCount");
  const duration = document.getElementById("duration");
  const liveCaptionCount = document.getElementById("liveCaptionCount");
  const liveDuration = document.getElementById("liveDuration");

  const apiUrlInput = document.getElementById("apiUrl");
  const authTokenInput = document.getElementById("authToken");
  const saveSettingsBtn = document.getElementById("saveSettings");

  // State
  let currentStatus = null;
  let durationInterval = null;
  let startTime = null;

  // Load saved settings
  const loadSettings = async () => {
    const { apiUrl, authToken } = await chrome.storage.local.get([
      "apiUrl",
      "authToken",
    ]);
    if (apiUrl) apiUrlInput.value = apiUrl;
    if (authToken) authTokenInput.value = authToken;
  };

  // Update UI based on status
  const updateUI = (status) => {
    currentStatus = status;

    // Hide all sections first
    notInMeeting.classList.add("hidden");
    inMeeting.classList.add("hidden");
    recordingActive.classList.add("hidden");

    if (status.isRecording) {
      // Recording active
      recordingActive.classList.remove("hidden");
      statusText.textContent = "Recording";
      statusDot.classList.add("recording");

      liveCaptionCount.textContent = status.captionCount;
      startDurationTimer();
    } else if (status.isInMeeting) {
      // In meeting but not recording
      inMeeting.classList.remove("hidden");
      statusText.textContent = "In Meeting";
      statusDot.classList.remove("recording");

      // Update meeting info
      if (status.currentMeeting) {
        platformBadge.textContent =
          status.currentMeeting.platform === "google-meet"
            ? "Google Meet"
            : status.currentMeeting.platform === "teams"
            ? "Teams"
            : "Zoom";
        meetingTitle.textContent =
          status.currentMeeting.meetingTitle || "Meeting";
        meetingId.textContent = `ID: ${status.currentMeeting.meetingId}`;
      }

      captionCount.textContent = status.captionCount;
      duration.textContent = "00:00";
    } else {
      // Not in meeting
      notInMeeting.classList.remove("hidden");
      statusText.textContent = "Ready";
      statusDot.classList.remove("recording");
      stopDurationTimer();
    }
  };

  // Get status from background script
  const refreshStatus = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
      updateUI(response);
    } catch (error) {
      console.error("Failed to get status:", error);
    }
  };

  // Start recording
  const startRecording = async () => {
    recordBtn.disabled = true;
    recordBtn.innerHTML =
      '<span class="record-icon">⏳</span><span class="btn-text">Starting...</span>';

    try {
      const response = await chrome.runtime.sendMessage({
        type: "START_RECORDING",
        data: {
          title: meetingTitle.textContent,
        },
      });

      if (response.success) {
        refreshStatus();
      } else {
        alert("Failed to start recording: " + (response.error || "Unknown error"));
        recordBtn.disabled = false;
        recordBtn.innerHTML =
          '<span class="record-icon">🔴</span><span class="btn-text">Start Recording</span>';
      }
    } catch (error) {
      console.error("Failed to start recording:", error);
      alert("Failed to start recording. Please check your settings.");
      recordBtn.disabled = false;
      recordBtn.innerHTML =
        '<span class="record-icon">🔴</span><span class="btn-text">Start Recording</span>';
    }
  };

  // Stop recording
  const stopRecording = async () => {
    stopBtn.disabled = true;
    stopBtn.innerHTML =
      '<span class="stop-icon">⏳</span><span class="btn-text">Stopping...</span>';

    try {
      const response = await chrome.runtime.sendMessage({
        type: "STOP_RECORDING",
      });

      if (response.success) {
        stopDurationTimer();
        refreshStatus();
        alert(
          `Meeting ended! ${response.meeting.extractedTasks?.length || 0} tasks extracted.`
        );
      } else {
        alert("Failed to stop recording: " + (response.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Failed to stop recording:", error);
      alert("Failed to stop recording.");
    } finally {
      stopBtn.disabled = false;
      stopBtn.innerHTML =
        '<span class="stop-icon">⏹</span><span class="btn-text">Stop Recording</span>';
    }
  };

  // Save settings
  const saveSettings = async () => {
    const apiUrl = apiUrlInput.value.trim();
    const authToken = authTokenInput.value.trim();

    if (apiUrl) {
      await chrome.storage.local.set({ apiUrl });
    }
    if (authToken) {
      await chrome.storage.local.set({ authToken });
    }

    // Show feedback
    saveSettingsBtn.textContent = "Saved!";
    setTimeout(() => {
      saveSettingsBtn.textContent = "Save Settings";
    }, 2000);
  };

  // Duration timer
  const startDurationTimer = () => {
    if (durationInterval) return;
    startTime = Date.now();
    durationInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const mins = Math.floor(elapsed / 60)
        .toString()
        .padStart(2, "0");
      const secs = (elapsed % 60).toString().padStart(2, "0");
      const timeStr = `${mins}:${secs}`;

      if (liveDuration) liveDuration.textContent = timeStr;
      if (duration) duration.textContent = timeStr;
    }, 1000);
  };

  const stopDurationTimer = () => {
    if (durationInterval) {
      clearInterval(durationInterval);
      durationInterval = null;
    }
  };

  // Event listeners
  recordBtn.addEventListener("click", startRecording);
  stopBtn.addEventListener("click", stopRecording);
  saveSettingsBtn.addEventListener("click", saveSettings);

  // Listen for status updates from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "MEETING_STATUS_CHANGED") {
      refreshStatus();
    }
  });

  // Initialize
  loadSettings();
  refreshStatus();

  // Refresh status periodically
  setInterval(refreshStatus, 2000);
});
