# TaskFlow

A premium, offline-first task management application with focus mode, voice input, and intelligent scheduling.

[![Version](https://img.shields.io/badge/version-2.3.0-orange.svg)](https://github.com/RishvanthAmsaraj/TaskFlow)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Features

- **Focus Mode** - Pomodoro timer with customizable durations (1-180 minutes)
- **Voice Input** - Robust speech-to-text with real-time transcription and processing indicators
- **Streaks and Achievements** - 8 unlockable achievements to gamify productivity
- **Subtasks** - Nested checklists within tasks with visual progress bars
- **Inline Editing** - Edit task details without leaving the list view
- **Smart Filters** - Quickly filter by All, Active, Completed, or High Priority
- **Templates** - 6 preset workflows for common routines
- **Dark/Light Mode** - Full theme support with system preference detection
- **PWA Ready** - Install as a native-like app, works offline
- **Privacy First** - All data stays on your device, zero external dependencies

## Quick Start

### Web (Recommended)

1. Open `index.html` in any modern browser
2. Click "Add to Home Screen" for app-like experience
3. Works offline after first load

### Android APK

Download the latest APK from [GitHub Releases](../../releases) or build locally:

```bash
npm install
npx cap sync
npx cap open android
```

## Development

### Prerequisites

- Node.js 20+
- Java 17 (for Android builds)
- Android Studio (for APK generation)

### Local Setup

```bash
git clone https://github.com/RishvanthAmsaraj/TaskFlow.git
cd TaskFlow
npm install
```

### Build APK

```bash
npm run build
```

## Architecture

```
TaskFlow/
├── css/
│   └── app.css           # Premium design system
├── js/
│   └── app.js            # Single-file application logic
├── index.html            # Main entry point
├── manifest.json         # PWA manifest
├── sw.js                 # Service worker for offline support
├── capacitor.config.json # Mobile wrapper config
└── .github/
    └── workflows/
        └── build-apk.yml # CI/CD pipeline
```

## Security

- **Zero API Keys** - No external services required
- **Zero Tracking** - No analytics or telemetry
- **Local Storage Only** - Your data never leaves your device
- **Open Source** - Full transparency

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- Built with [Capacitor](https://capacitorjs.com/) for mobile builds
- Icons by [Feather Icons](https://feathericons.com/)
- Font: [Inter](https://rsms.me/inter/)

---

Built by [Rishvanth Amsaraj](https://github.com/RishvanthAmsaraj)
