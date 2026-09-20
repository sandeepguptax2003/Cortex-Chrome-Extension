# Cortex AI - Meeting Task Extractor

A Chrome Extension that automatically extracts tasks from Zoom, Google Meet, and Microsoft Teams meetings using AI. It captures live captions/transcripts, sends them to the Cortex AI backend for processing, and extracts actionable tasks that are added to your Board.

> **Project Status:** Cortex AI was a live, fully deployed platform — [Semifinalist, AWS 10,000 AIdeas Competition 2025](https://builder.aws.com/content/3B84yzRMPmtfrqTZ1WpfN50Jitg/aideas-cortex-ai-the-ai-powered-meeting-intelligence-platform). The backend it connects to has since been taken offline as part of AWS cost/billing cleanup; this extension's capture pipeline is fully functional and documented below. Companion repos: [Backend](https://github.com/sandeepguptax2003/Cortex-AI-Backend) · [Frontend](https://github.com/sandeepguptax2003/cortex-ai-frontend).

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [File Structure](#file-structure)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Integration](#api-integration)
- [Permissions](#permissions)
- [Development](#development)
- [Troubleshooting](#troubleshooting)

---

## Overview

Cortex AI Extension is a browser extension built with **Manifest V3** that integrates with popular video conferencing platforms to:

1. **Detect** when you join a meeting (Zoom, Google Meet, Teams)
2. **Capture** live captions/transcripts from the meeting
3. **Stream** captions to the Cortex AI backend in real-time
4. **Extract** actionable tasks using AI processing
5. **Notify** your team via email summaries when meetings end

---

## Features

### Core Features

| Feature | Description |
|---------|-------------|
| **Multi-Platform Support** | Works with Zoom, Google Meet, and Microsoft Teams |
| **Real-time Caption Capture** | Captures live transcripts using DOM mutation observers |
| **AI Task Extraction** | Sends captions to backend for AI-powered task extraction |
| **Auto-Join Scheduler** | Schedule meetings to automatically open and start recording |
| **Live Recording Indicator** | Visual feedback when recording is active |
| **Duration Tracking** | Tracks meeting duration in real-time |
| **Caption Counter** | Shows number of captions captured |

### Platform-Specific Caption Capture

- **Zoom**: Captures from transcript panel (`[role="log"]`, `.transcript-panel`, `.live-transcript`)
- **Google Meet**: Captures from caption containers (`[data-caption-id]`, `.a4cQT`)
- **Microsoft Teams**: Captures from closed captions container (`[data-tid="closed-captions-container"]`)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CHROME EXTENSION                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │   Popup UI   │◄──►│   Background │◄──►│   Content    │                  │
│  │  (popup.js)  │    │  (background.js)   │  (content.js)│                  │
│  └──────────────┘    └──────┬───────┘    └──────┬───────┘                  │
│         │                   │                    │                          │
│         ▼                   ▼                    ▼                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │  popup.html  │    │ Chrome APIs  │    │   Meeting    │                  │
│  │  popup.css   │    │ (storage,    │    │    Page      │                  │
│  │              │    │  alarms,     │    │   (DOM)      │                  │
│  │              │    │  tabs)       │    │              │                  │
│  └──────────────┘    └──────┬───────┘    └──────────────┘                  │
│                             │                                               │
└─────────────────────────────┼───────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │      CORTEX AI BACKEND        │
              │  ┌─────────────────────────┐  │
              │  │  POST /user/meetings/   │  │
              │  │        start            │  │
              │  └─────────────────────────┘  │
              │  ┌─────────────────────────┐  │
              │  │  POST /user/meetings/   │  │
              │  │    {id}/end             │  │
              │  └─────────────────────────┘  │
              │  ┌─────────────────────────┐  │
              │  │  POST /integrations/    │  │
              │  │    bot/captions         │  │
              │  └─────────────────────────┘  │
              └───────────────────────────────┘
```

---

## File Structure

```
Cortex-Chrome-Extension/
├── manifest.json          # Extension manifest (Manifest V3)
├── background.js          # Service worker - core logic & API communication
├── content.js             # Content script - caption capture from meeting pages
├── popup.html             # Extension popup UI HTML
├── popup.js               # Popup UI logic and event handling
├── popup.css              # Popup UI styles
├── icons/                 # Extension icons
│   ├── icon16.png         # Toolbar icon (16x16)
│   ├── icon48.png         # Extension icon (48x48)
│   └── icon128.png        # Store icon (128x128)
└── README.md              # This file
```

---

## Installation

### From Source (Developer Mode)

1. **Clone or download** this repository
   ```bash
   git clone <repository-url>
   cd Cortex-Chrome-Extension
   ```

2. **Open Chrome Extensions page**
   - Navigate to `chrome://extensions/`
   - Or click menu → More tools → Extensions

3. **Enable Developer Mode**
   - Toggle "Developer mode" switch in the top right

4. **Load Extension**
   - Click "Load unpacked"
   - Select the `Cortex-Chrome-Extension` folder
   - The extension icon should appear in your toolbar

### Verify Installation

- The Cortex AI icon ("C") should appear in your Chrome toolbar
- Click the icon to open the popup
- You should see "Ready" status with green dot

---

## Configuration

### Initial Setup

1. **Click the extension icon** to open the popup
2. **Click "⚙️ Settings"** to expand the settings panel
3. **Configure API URL**:
   - Production: `https://rq6ypa7pyw.ap-south-1.awsapprunner.com`
   - Development: `http://localhost:8080`
4. **Add Auth Token**:
   - Get your JWT token from the Cortex AI Dashboard → Profile
   - Paste it in the "Auth Token" field
5. **Click "Save Settings"**

### Settings Storage

Settings are stored in Chrome's local storage:

| Key | Type | Description |
|-----|------|-------------|
| `apiUrl` | string | Backend API base URL |
| `authToken` | string | JWT authentication token |
| `isRecording` | boolean | Current recording state |
| `activeMeetingId` | string | Currently active meeting ID |
| `captions` | array | Captured captions buffer |
| `scheduledMeetings` | array | List of scheduled meetings |

---

## Usage

### Recording a Meeting

1. **Join a Meeting**
   - Open Zoom, Google Meet, or Microsoft Teams
   - Join any meeting
   - The extension will automatically detect the meeting

2. **Start Recording**
   - Click the Cortex AI extension icon
   - Click the **"🔴 Start Recording"** button
   - The status will change to "Recording" with a red pulse animation

3. **During Recording**
   - Captions are automatically captured and sent to the backend
   - Live stats show caption count and elapsed time
   - The extension badge shows "LIVE" on the meeting tab

4. **Stop Recording**
   - Click **"⏹ Stop Recording"**
   - The meeting ends and tasks are extracted
   - Email summaries are sent to your team
   - You'll see a confirmation with the number of tasks extracted

### Scheduling Auto-Join

1. **Open the Schedule Tab**
   - Click the extension icon
   - Click **"📅 Schedule"** tab

2. **Fill Meeting Details**
   - **Meeting URL**: Paste the meeting link (e.g., `https://meet.google.com/abc-defg-hij`)
   - **Meeting Title**: Give it a recognizable name
   - **Date & Time**: Select when to auto-join

3. **Schedule**
   - Click **"⏰ Schedule Auto-Join"**
   - The meeting will appear in "Upcoming Meetings"

4. **Auto-Join Behavior**
   - At the scheduled time, Chrome will open the meeting URL
   - Recording will automatically start
   - You can cancel scheduled meetings anytime

---

## API Integration

### Endpoints

The extension communicates with the Cortex AI backend using these endpoints:

#### 1. Start Meeting
```http
POST /user/meetings/start
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "Meeting Title"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "meeting": {
      "meetingId": "uuid-string"
    }
  }
}
```

#### 2. End Meeting
```http
POST /user/meetings/{meetingId}/end
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "meeting": {
      "meetingId": "uuid-string",
      "extractedTasks": [...]
    }
  }
}
```

#### 3. Send Captions
```http
POST /integrations/bot/captions
Authorization: Bearer {token}
Content-Type: application/json

{
  "meetingId": "uuid-string",
  "text": "Speaker: Caption text here",
  "timestamp": 1712345678901
}
```

### Authentication

All API requests require a JWT token in the `Authorization` header:
```
Authorization: Bearer <your-jwt-token>
```

---

## Permissions

The extension requires the following permissions:

| Permission | Purpose |
|------------|---------|
| `activeTab` | Access the current tab for meeting detection |
| `storage` | Store settings, captions, and scheduled meetings |
| `scripting` | Execute content scripts on meeting pages |
| `tabs` | Monitor tab updates for platform detection |
| `alarms` | Schedule automatic meeting joins |

### Host Permissions

The extension runs on these meeting platforms:

```json
[
  "https://zoom.us/*",
  "https://*.zoom.us/*",
  "https://meet.google.com/*",
  "https://teams.microsoft.com/*",
  "https://*.teams.microsoft.com/*"
]
```

---

## Development

### Code Structure

#### `manifest.json`
- Defines extension metadata, permissions, and entry points
- Configures content scripts for meeting platforms
- Sets up the service worker (background.js)

#### `background.js` (Service Worker)
- **Message Router**: Handles messages from popup and content scripts
- **Meeting Detection**: Maintains in-memory map of active meetings
- **Caption Handling**: Receives captions from content script and forwards to API
- **Recording Control**: Starts/stops meetings via API calls
- **Auto-Join Scheduler**: Uses Chrome alarms for scheduled meetings

Key functions:
- `handleMeetingDetected()` - Registers new meeting
- `handleCaptionReceived()` - Processes and forwards captions
- `startRecording()` - Calls API to start meeting
- `stopRecording()` - Calls API to end meeting
- `scheduleMeeting()` - Creates Chrome alarm for auto-join

#### `content.js` (Content Script)
- **Platform Detection**: Identifies meeting platform from URL
- **Meeting ID Extraction**: Parses meeting ID from URL patterns
- **Caption Capture**: Uses MutationObserver to detect new captions
- **Speaker Extraction**: Parses speaker names from caption format

Platform-specific selectors:
- **Zoom**: `[role="log"]`, `.transcript-panel`, `.live-transcript`
- **Google Meet**: `[data-caption-id]`, `.a4cQT`, `.ZjFb7c` (speaker), `.bPsqDc` (text)
- **Teams**: `[data-tid="closed-captions-container"]`, `.ui-chat__list`

#### `popup.js` (Popup Logic)
- **UI State Management**: Shows appropriate view based on meeting/recording state
- **Tab Navigation**: Switches between Recording and Schedule tabs
- **Settings Management**: Loads/saves API URL and auth token
- **Duration Timer**: Updates elapsed time display during recording
- **Schedule Management**: Creates and cancels scheduled meetings

UI States:
1. `notInMeeting` - No active meeting detected
2. `inMeeting` - In a meeting, ready to record
3. `recordingActive` - Currently recording with live stats

### Message Types

Communication between components uses these message types:

| Type | Direction | Description |
|------|-----------|-------------|
| `MEETING_DETECTED` | Content → Background | New meeting detected |
| `MEETING_ENDED` | Content → Background | Meeting ended/unloaded |
| `CAPTION_RECEIVED` | Content → Background | New caption captured |
| `GET_STATUS` | Popup → Background | Request current status |
| `START_RECORDING` | Popup → Background | Start recording |
| `STOP_RECORDING` | Popup → Background | Stop recording |
| `SET_API_URL` | Popup → Background | Update API URL |
| `SCHEDULE_MEETING` | Popup → Background | Schedule auto-join |
| `GET_SCHEDULES` | Popup → Background | Get scheduled meetings |
| `CANCEL_SCHEDULE` | Popup → Background | Cancel scheduled meeting |
| `MEETING_STATUS_CHANGED` | Background → Popup | Status update broadcast |

### Development Tips

1. **Debug Background Script**
   - Go to `chrome://extensions/`
   - Click "service worker" link under the extension
   - Use Chrome DevTools console

2. **Debug Content Script**
   - Open a meeting page
   - Open Chrome DevTools (F12)
   - Look for `[Cortex AI]` logs in the console

3. **Debug Popup**
   - Right-click the extension icon
   - Click "Inspect popup"
   - Use Chrome DevTools

4. **Reload Extension**
   - After code changes, click the refresh icon on `chrome://extensions/`
   - Or use `Ctrl+R` in the service worker DevTools

---

## Troubleshooting

### Common Issues

#### "Not authenticated" Error
- **Cause**: Auth token not set or expired
- **Solution**: Open Settings and paste a valid JWT token from the Dashboard

#### Captions Not Capturing
- **Cause**: Platform UI changed, selectors outdated
- **Solution**: Check content.js selectors match current platform DOM

#### Extension Not Detecting Meeting
- **Cause**: URL pattern doesn't match
- **Solution**: Verify you're on a supported platform URL

#### Auto-Join Not Working
- **Cause**: Chrome alarms cleared or extension reloaded
- **Solution**: Reschedule the meeting; alarms persist until triggered or canceled

### Debug Logging

Enable console logging to diagnose issues:
- Content script logs: `[Cortex AI] Content script loaded for {platform}`
- Caption processing: Check for `Caption send failed` errors
- API errors: Check Network tab in DevTools

### Reset Extension

To completely reset the extension:
1. Open Chrome DevTools in popup
2. Run: `chrome.storage.local.clear()`
3. Reload the extension
4. Reconfigure settings

---

## License

[Add your license information here]

---

## Support

For support, contact:
- Dashboard: https://cortexai.app/dashboard
- Email: [Add support email]

---

## Changelog

### v1.0.0
- Initial release
- Support for Zoom, Google Meet, and Microsoft Teams
- Real-time caption capture
- AI task extraction
- Auto-join scheduler
- Recording controls with live stats
