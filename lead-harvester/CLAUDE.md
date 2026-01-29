# LeadHarvester - Claude Code Project Documentation

## Project Overview
LeadHarvester is a local-first desktop application for extracting business leads from Google Maps search results and enriching them with contact information from business websites.

## Architecture

### Tech Stack
- **Frontend**: Electron + Vite + React + TypeScript
- **Backend**: Node.js (Electron main process)
- **Browser Automation**: Playwright (Chromium)
- **Database**: better-sqlite3 (synchronous SQLite)
- **Validation**: Zod
- **Build/Package**: electron-builder

### Directory Structure
```
lead-harvester/
├── src/
│   ├── main/           # Electron main process
│   │   ├── index.ts    # Entry point
│   │   ├── ipc/        # IPC handlers
│   │   ├── database/   # SQLite operations
│   │   ├── scraper/    # Playwright scraping
│   │   └── utils/      # Helpers (scoring, CSV, logging)
│   ├── renderer/       # React UI
│   │   ├── components/ # React components
│   │   ├── hooks/      # Custom hooks
│   │   └── store/      # State management
│   ├── shared/         # Shared types and schemas
│   └── preload/        # Electron preload script
├── tests/              # Automated tests
└── fixtures/           # Demo mode HTML fixtures
```

## Key Implementation Details

### Database Schema
- `projects`: Project metadata and settings
- `leads`: Extracted business leads
- `run_state`: Scraping state for pause/resume
- `logs`: Per-run logging
- `settings`: App settings

### Scraping Flow
1. User creates project with keyword + location
2. Playwright opens Google Maps, performs search
3. Scrolls to load results (respecting max limit)
4. Extracts business data from each listing
5. Deduplicates by URL and name+address
6. Enrichment: visits websites to find emails
7. Computes lead scores
8. Results stored in SQLite, exportable to CSV

### IPC Channels
- `projects:*` - CRUD for projects
- `scraper:*` - Start/pause/resume/stop runs
- `leads:*` - Query and filter leads
- `settings:*` - App settings
- `export:*` - CSV export
- `logs:*` - Log streaming

### Error Handling
- All operations wrapped in try/catch
- Errors stored in database per-lead
- UI shows errors without blocking other work
- Resumable runs survive crashes

### Rate Limiting
- Configurable delays between actions
- Random jitter added to delays
- Backoff on errors
- "Safe Mode" for extra caution

## Development Commands
```bash
npm install          # Install dependencies
npm run dev          # Start development
npm run build        # Build for production
npm run package      # Create installers
npm run test         # Run tests
```

## Data Storage Location
- macOS: `~/Library/Application Support/LeadHarvester/`
- Windows: `%APPDATA%/LeadHarvester/`

## Compliance Notes
- Only scrapes publicly visible data
- No login credentials required
- User responsible for compliance with ToS
- Rate limiting built-in to minimize detection
