# LeadHarvester

A local-first desktop application for extracting business leads from Google Maps search results and enriching them with contact information from business websites.

## Features

- **Project-based workflow**: Create projects with keyword + location to organize your lead harvesting
- **Google Maps scraping**: Automatically search and extract business information
- **Email enrichment**: Visit business websites to find emails and contact pages
- **Lead scoring**: Automatic scoring (0-100) based on completeness of data
- **Filters & search**: Filter by email, website, rating, reviews, and more
- **Opportunity Finder**: Find businesses with phone but no website/email (outreach targets)
- **CSV export**: Export filtered or all leads to CSV
- **Pause/Resume**: Stop and continue runs without losing progress
- **Demo Mode**: Test the app without hitting Google Maps

## Tech Stack

- **Frontend**: Electron + Vite + React + TypeScript + Tailwind CSS
- **Backend**: Node.js (Electron main process)
- **Browser Automation**: Playwright
- **Database**: SQLite (better-sqlite3)
- **Validation**: Zod

## Installation

### Prerequisites

- Node.js 18+
- npm 9+

### Setup

```bash
# Clone or download the repository
cd lead-harvester

# Install dependencies
npm install

# Install Playwright browsers (required for scraping)
npx playwright install chromium
```

## Development

```bash
# Start development mode (hot reload)
npm run dev

# In another terminal, start Electron
npm run start
```

## Building

```bash
# Build for production
npm run build

# Create installers
npm run package          # For current platform
npm run package:mac      # macOS only
npm run package:win      # Windows only
```

Installers will be created in the `release/` directory.

## Testing

```bash
# Run tests
npm run test

# Run tests in watch mode
npm run test:watch
```

## Usage

### Creating a Project

1. Click "New Project" on the Projects page
2. Enter a project name (e.g., "Restaurants in Chicago")
3. Enter search keyword (e.g., "restaurants")
4. Enter location (e.g., "Chicago, IL")
5. Set max results (default: 50)
6. Click "Create Project"

### Running a Scrape

1. Open your project
2. Click "Start Run"
3. Choose "Real Mode" for actual Google Maps scraping or "Demo Mode" for testing
4. Watch progress in the dashboard
5. Scraping extracts business name, category, rating, reviews, phone, website
6. Enrichment visits websites to find emails

### Filtering Leads

Use the filter bar to:
- **Has Email**: Show only leads with discovered emails
- **Has Website**: Show only leads with websites
- **Opportunity Finder**: Show leads with phone but missing website/email
- **Min Rating**: Filter by minimum star rating
- **Min Reviews**: Filter by minimum review count

### Exporting

1. Apply any filters you want
2. Click "Export CSV"
3. Choose save location
4. CSV includes all lead data including emails

## How Scraping Works

### Google Maps Extraction

1. Opens Google Maps in a headless browser
2. Searches for `<keyword> <location>`
3. Scrolls through results list
4. For each listing, clicks to get details (phone, website)
5. Deduplicates by URL and name+address

### Email Enrichment

For each lead with a website:
1. Visits the homepage
2. Checks common contact paths (/contact, /about, /team, etc.)
3. Extracts emails from:
   - mailto: links
   - Visible text
   - Page source
   - JSON-LD structured data
   - Footer sections
4. Filters out junk emails (noreply, test@, etc.)
5. Prioritizes business-domain emails

## Data Storage

All data is stored locally on your computer:

- **macOS**: `~/Library/Application Support/LeadHarvester/`
- **Windows**: `%APPDATA%/LeadHarvester/`

Database file: `leadharvester.db` (SQLite)

## Settings

### Scraping Settings

- **Safe Mode**: Slower scraping with more delays (recommended)
- **Concurrency**: 1-3 parallel enrichment tasks
- **Delay Between Actions**: Minimum delay between operations
- **Website Crawl Timeout**: How long to wait for pages to load
- **User Agent**: Browser identity for scraping

### Tips for Avoiding Blocks

1. **Enable Safe Mode**: Adds extra delays and randomization
2. **Use lower concurrency**: 1 is safest
3. **Scrape in smaller batches**: 50 results at a time
4. **Take breaks between large runs**: Wait 30+ minutes
5. **Use Demo Mode to test**: Verify the app works before real scrapes

## Troubleshooting

### "Unusual Traffic" Error

Google has detected automated access. Solutions:
1. Enable Safe Mode in settings
2. Wait 30+ minutes before trying again
3. Use a different network/IP
4. Reduce max results and concurrency

### Browser Won't Launch

1. Make sure Playwright is installed: `npx playwright install chromium`
2. On Linux, you may need additional dependencies: `npx playwright install-deps`

### App Crashes on Start

1. Delete the database file and restart:
   - macOS: `rm ~/Library/Application\ Support/LeadHarvester/leadharvester.db`
   - Windows: Delete `%APPDATA%/LeadHarvester/leadharvester.db`

### No Emails Found

Some websites don't have publicly visible emails. The enrichment:
- Only checks 6 pages max per site
- Has a timeout for slow sites
- Filters out obvious junk emails

## Compliance Notice

This tool scrapes only publicly visible information. **You are responsible for:**

- Complying with Google's Terms of Service
- Data protection laws (GDPR, CCPA, etc.)
- Anti-spam regulations (CAN-SPAM, etc.)
- Respecting opt-out requests

**Use responsibly. Don't spam.**

## License

MIT License

## Support

For bugs and feature requests, please open an issue on GitHub.
