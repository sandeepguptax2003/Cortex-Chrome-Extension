// Cortex AI Extension — Popup Script

document.addEventListener("DOMContentLoaded", async () => {

  // ─── DOM Refs ──────────────────────────────────────────────────────────────
  const statusBadge    = document.getElementById("statusBadge");
  const statusText     = statusBadge.querySelector(".status-text");
  const statusDot      = statusBadge.querySelector(".status-dot");

  const notInMeeting   = document.getElementById("notInMeeting");
  const inMeeting      = document.getElementById("inMeeting");
  const recordingActive = document.getElementById("recordingActive");

  const platformBadge  = document.getElementById("platformBadge");
  const meetingTitleEl = document.getElementById("meetingTitle");
  const meetingIdEl    = document.getElementById("meetingId");

  const recordBtn      = document.getElementById("recordBtn");
  const stopBtn        = document.getElementById("stopBtn");
  const captionCount   = document.getElementById("captionCount");
  const durationEl     = document.getElementById("duration");
  const liveCaptionCount = document.getElementById("liveCaptionCount");
  const liveDuration   = document.getElementById("liveDuration");

  const apiUrlInput    = document.getElementById("apiUrl");
  const authTokenInput = document.getElementById("authToken");
  const saveSettingsBtn = document.getElementById("saveSettings");

  // Schedule tab
  const schedMeetingUrl = document.getElementById("schedMeetingUrl");
  const schedTitle      = document.getElementById("schedTitle");
  const schedTime       = document.getElementById("schedTime");
  const scheduleBtn     = document.getElementById("scheduleBtn");
  const schedulesList   = document.getElementById("schedulesList");

  // Set min datetime for schedule to now
  const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString().slice(0, 16);
  schedTime.min = nowLocal;

  // ─── Tab Navigation ────────────────────────────────────────────────────────
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");

      if (btn.dataset.tab === "schedule") loadSchedules();
    });
  });

  // ─── State ─────────────────────────────────────────────────────────────────
  let durationInterval = null;
  let recordingStartTime = null;

  // ─── Settings ──────────────────────────────────────────────────────────────
  const loadSettings = async () => {
    const { apiUrl, authToken } = await chrome.storage.local.get(["apiUrl", "authToken"]);
    if (apiUrl) {
      apiUrlInput.value = apiUrl;
      // Update footer + dashboard links dynamically
      const frontendBase = apiUrl.includes("localhost") ? "http://localhost:3000" : "https://cortexai.app";
      document.getElementById("footerDashboardLink").href = `${frontendBase}/dashboard`;
      document.getElementById("dashboardLink").href = `${frontendBase}/settings`;
    }
    if (authToken) authTokenInput.value = authToken;
  };

  saveSettingsBtn.addEventListener("click", async () => {
    const apiUrl = apiUrlInput.value.trim();
    const authToken = authTokenInput.value.trim();
    const updates = {};
    if (apiUrl) updates.apiUrl = apiUrl;
    if (authToken) updates.authToken = authToken;
    if (Object.keys(updates).length) await chrome.storage.local.set(updates);
    saveSettingsBtn.textContent = "✓ Saved";
    setTimeout(() => (saveSettingsBtn.textContent = "Save Settings"), 2000);
  });

  // ─── Recording UI ──────────────────────────────────────────────────────────
  const updateUI = (status) => {
    notInMeeting.classList.add("hidden");
    inMeeting.classList.add("hidden");
    recordingActive.classList.add("hidden");

    if (status.isRecording) {
      recordingActive.classList.remove("hidden");
      statusText.textContent = "Recording";
      statusDot.classList.add("recording");
      liveCaptionCount.textContent = status.captionCount;
      startDurationTimer();
    } else if (status.isInMeeting) {
      inMeeting.classList.remove("hidden");
      statusText.textContent = "In Meeting";
      statusDot.classList.remove("recording");
      stopDurationTimer();

      if (status.currentMeeting) {
        const p = status.currentMeeting.platform;
        platformBadge.textContent = p === "google-meet" ? "Google Meet" : p === "teams" ? "Teams" : "Zoom";
        meetingTitleEl.textContent = status.currentMeeting.meetingTitle || "Meeting";
        meetingIdEl.textContent = `ID: ${status.currentMeeting.meetingId}`;
      }
      captionCount.textContent = status.captionCount;
      durationEl.textContent = "00:00";
    } else {
      notInMeeting.classList.remove("hidden");
      statusText.textContent = "Ready";
      statusDot.classList.remove("recording");
      stopDurationTimer();
    }
  };

  const refreshStatus = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
      updateUI(response);
    } catch (err) {
      console.error("GET_STATUS failed:", err);
    }
  };

  recordBtn.addEventListener("click", async () => {
    recordBtn.disabled = true;
    recordBtn.innerHTML = '<span class="record-icon">⏳</span><span class="btn-text">Starting...</span>';
    try {
      const response = await chrome.runtime.sendMessage({
        type: "START_RECORDING",
        data: { title: meetingTitleEl.textContent },
      });
      if (response.success) {
        refreshStatus();
      } else {
        alert("Failed to start: " + (response.error || "Unknown error"));
        recordBtn.disabled = false;
        recordBtn.innerHTML = '<span class="record-icon">🔴</span><span class="btn-text">Start Recording</span>';
      }
    } catch (err) {
      alert("Error: " + err.message);
      recordBtn.disabled = false;
      recordBtn.innerHTML = '<span class="record-icon">🔴</span><span class="btn-text">Start Recording</span>';
    }
  });

  stopBtn.addEventListener("click", async () => {
    stopBtn.disabled = true;
    stopBtn.innerHTML = '<span class="stop-icon">⏳</span><span class="btn-text">Stopping...</span>';
    try {
      const response = await chrome.runtime.sendMessage({ type: "STOP_RECORDING" });
      if (response.success) {
        stopDurationTimer();
        refreshStatus();
        const taskCount = response.meeting?.extractedTasks?.length || 0;
        alert(`Meeting ended! ${taskCount > 0 ? `${taskCount} tasks extracted and added to your Board.` : "Transcript saved. Use the Meetings page to extract tasks."}\n\nEmail summaries sent to your team.`);
      } else {
        alert("Failed to stop: " + (response.error || "Unknown error"));
      }
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      stopBtn.disabled = false;
      stopBtn.innerHTML = '<span class="stop-icon">⏹</span><span class="btn-text">Stop Recording</span>';
    }
  });

  // ─── Duration Timer ────────────────────────────────────────────────────────
  const startDurationTimer = () => {
    if (durationInterval) return;
    recordingStartTime = Date.now();
    durationInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
      const mm = Math.floor(elapsed / 60).toString().padStart(2, "0");
      const ss = (elapsed % 60).toString().padStart(2, "0");
      const t = `${mm}:${ss}`;
      if (liveDuration) liveDuration.textContent = t;
      if (durationEl) durationEl.textContent = t;
    }, 1000);
  };

  const stopDurationTimer = () => {
    if (durationInterval) { clearInterval(durationInterval); durationInterval = null; }
  };

  // ─── Schedule Tab ──────────────────────────────────────────────────────────
  scheduleBtn.addEventListener("click", async () => {
    const meetingUrl = schedMeetingUrl.value.trim();
    const title = schedTitle.value.trim() || "Scheduled Meeting";
    const scheduledAt = schedTime.value;

    if (!meetingUrl) { alert("Please enter a meeting URL"); return; }
    if (!scheduledAt) { alert("Please select a date and time"); return; }
    if (!meetingUrl.startsWith("http")) { alert("Meeting URL must start with http/https"); return; }

    scheduleBtn.disabled = true;
    scheduleBtn.textContent = "Scheduling...";

    try {
      const response = await chrome.runtime.sendMessage({
        type: "SCHEDULE_MEETING",
        data: { meetingUrl, title, scheduledAt },
      });

      if (response.success) {
        schedMeetingUrl.value = "";
        schedTitle.value = "";
        schedTime.value = "";
        scheduleBtn.textContent = "✓ Scheduled!";
        setTimeout(() => { scheduleBtn.textContent = "⏰ Schedule Auto-Join"; scheduleBtn.disabled = false; }, 2000);
        loadSchedules();
      } else {
        alert("Failed: " + response.error);
        scheduleBtn.textContent = "⏰ Schedule Auto-Join";
        scheduleBtn.disabled = false;
      }
    } catch (err) {
      alert("Error: " + err.message);
      scheduleBtn.textContent = "⏰ Schedule Auto-Join";
      scheduleBtn.disabled = false;
    }
  });

  const loadSchedules = async () => {
    try {
      const schedules = await chrome.runtime.sendMessage({ type: "GET_SCHEDULES" });
      if (!schedules || schedules.length === 0) {
        schedulesList.innerHTML = '<div class="no-schedules">No meetings scheduled</div>';
        return;
      }

      schedulesList.innerHTML = schedules
        .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
        .map((s) => {
          const dt = new Date(s.scheduledAt);
          const formatted = dt.toLocaleString(undefined, {
            month: "short", day: "numeric",
            hour: "2-digit", minute: "2-digit",
          });
          return `
            <div class="schedule-item">
              <div class="schedule-item-info">
                <div class="schedule-item-title">${escapeHtml(s.title)}</div>
                <div class="schedule-item-time">📅 ${formatted}</div>
                <div class="schedule-item-url">${escapeHtml(s.meetingUrl)}</div>
              </div>
              <button class="btn-cancel-schedule" data-alarm="${escapeHtml(s.alarmName)}">Cancel</button>
            </div>
          `;
        })
        .join("");

      schedulesList.querySelectorAll(".btn-cancel-schedule").forEach((btn) => {
        btn.addEventListener("click", async () => {
          btn.textContent = "...";
          btn.disabled = true;
          await chrome.runtime.sendMessage({ type: "CANCEL_SCHEDULE", data: { alarmName: btn.dataset.alarm } });
          loadSchedules();
        });
      });
    } catch (err) {
      schedulesList.innerHTML = '<div class="no-schedules">Could not load schedules</div>';
    }
  };

  const escapeHtml = (str) =>
    str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  // ─── Background Messages ───────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "MEETING_STATUS_CHANGED") refreshStatus();
  });

  // ─── Init ──────────────────────────────────────────────────────────────────
  await loadSettings();
  await refreshStatus();
  setInterval(refreshStatus, 3000);
});
