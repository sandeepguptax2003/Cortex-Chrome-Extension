# Cortex AI Chrome Extension

Automatically extract tasks from Zoom, Google Meet, and Microsoft Teams meetings using AI.

![Extension Interface](https://github-production-user-asset-6210df.s3.amazonaws.com/119393286/572666894-a6a610be-398f-47ea-a452-591f7d24e250.webp?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAVCODYLSA53PQK4ZA%2F20260401%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260401T173853Z&X-Amz-Expires=300&X-Amz-Signature=1baf8148e31fd917bf5f425058994b56627b84a3d006c750db176e81dc74cae7&X-Amz-SignedHeaders=host)

## Features

- 🔴 **One-click recording** - Start capturing meeting captions instantly
- 🤖 **AI-powered extraction** - Automatically identifies and extracts actionable tasks
- 📊 **Real-time stats** - See caption count and recording duration
- 🔔 **Instant notifications** - Get notified when tasks are extracted
- 🔗 **Seamless integration** - Works directly with your Cortex AI dashboard

## Supported Platforms

- ✅ Zoom
- ✅ Google Meet
- ✅ Microsoft Teams

## Installation

### From Source (Developer Mode)

1. Download or clone this extension folder
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. The Cortex AI icon should appear in your browser toolbar

### Configure the Extension

1. Click the Cortex AI icon in your browser toolbar
2. Open the Settings dropdown
3. Enter your API URL (e.g., `http://localhost:5572`)
4. Enter your authentication token (from your Cortex AI dashboard)
5. Click "Save Settings"

## Usage

### Starting a Recording

1. Join a meeting on Zoom, Google Meet, or Teams
2. Click the Cortex AI extension icon
3. Click "Start Recording"
4. The AI will automatically capture captions and extract tasks

### During the Meeting

- The extension shows live caption count
- Recording duration is displayed in real-time
- A red pulse indicator shows recording is active

### Ending a Recording

1. Click "Stop Recording" in the extension
2. Tasks will be automatically extracted and sent to your dashboard
3. You'll receive a notification with the number of tasks extracted

## How It Works

1. **Caption Capture** - The extension monitors the meeting page for live captions/transcripts
2. **Real-time Processing** - Captions are sent to the Cortex AI API as they're detected
3. **AI Analysis** - Amazon Bedrock AI analyzes the conversation for actionable tasks
4. **Task Creation** - Extracted tasks are automatically created in your Kanban board
5. **Notifications** - Team members receive email and Slack notifications

## Troubleshooting

### Extension not detecting captions

- Make sure captions are enabled in your meeting platform
- Try refreshing the meeting page
- Check that the extension has permission to access the site

### Recording fails to start

- Verify your API URL is correct
- Check that your auth token is valid
- Ensure you're logged into the Cortex AI dashboard

### Captions not being captured

- Some platforms require captions to be manually enabled
- Zoom: Click "Show Captions" in the meeting controls
- Google Meet: Click the CC button to enable captions
- Teams: Enable live captions from the menu

## Privacy & Security

- All data is sent securely to your Cortex AI instance
- Captions are only captured when you explicitly start recording
- No data is stored locally except configuration settings
- Authentication tokens are stored securely in Chrome's storage

## Development

### File Structure

```
cortex-chrome-extension/
├── manifest.json      # Extension manifest
├── background.js      # Service worker for API communication
├── content.js         # Content script for caption capture
├── popup.html         # Extension popup UI
├── popup.css          # Popup styles
├── popup.js           # Popup logic
├── injected.js        # Script injected into meeting pages
├── icons/             # Extension icons
└── README.md          # This file
```

### Building

No build step required - this is a vanilla JavaScript extension.

### Testing

1. Load the extension in developer mode
2. Open Chrome DevTools for the background script
3. Check the console for logs and errors

## License

MIT License - Part of the Cortex AI Platform
