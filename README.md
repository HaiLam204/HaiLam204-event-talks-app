# BigQuery Release Pulse 🚀

**BigQuery Release Pulse** is a modern, high-fidelity web application built with a Python Flask backend and a plain vanilla HTML/JS/CSS frontend. It fetches Google Cloud's BigQuery Atom release notes feed, parses the entries, and displays them in a gorgeous glassmorphic UI. It also provides sharing features, allowing users to compose tweets for individual updates or compile a multi-selected digest to post directly to X (Twitter).

---

## ✨ Features

- **🌐 Live RSS/Atom Feed Fetching**: Automatically pulls the latest release notes from the Google Cloud BigQuery feed.
- **⚡ Smart Caching & Refresh**: Caches parsed release notes locally for 5 minutes (`feed_cache.json`) to guarantee fast page loads and avoid feed spam. Includes a manual force-refresh spinner.
- **🧩 Granular Entry Parsing**: Atom feed entries group daily updates into one paragraph. The parser splits them by `<h3>` tags, isolating individual features, issues, and deprecations into card items.
- **🔍 Real-time Search & Category Filters**: Search updates by text or filter by categories (`Feature`, `Issue`, `Deprecated`, `Changed`) with live counters.
- **🌓 Dark & Light Modes**: Premium dark mode by default with glowing mesh gradients, alongside a clean light mode. Remembers your theme choice via `localStorage`.
- **🐦 Integrated X/Twitter Composer**:
  - **Single Update**: Share a specific card with a clean, pre-formatted draft.
  - **Digest Creation**: Select multiple cards to compile a list-based digest tweet.
  - **Character Limit Guard**: An edit modal with a live character counter that compensates for X's 23-character URL wrapping policy.
  - **Intent Launcher**: Posts directly to X via a secure, official Twitter Web Intent.

---

## 🛠️ Technology Stack

- **Backend**: Python 3, Flask, XML ElementTree Parser, Requests
- **Frontend**: Vanilla HTML5, CSS3 (CSS Variables, Flexbox/Grid, Animations), Vanilla JS (ES6)
- **Icons**: Lucide Icons

---

## 📂 Project Structure

```text
D:\agy-cli-projects\
├── app.py                  # Flask Application & Atom parsing backend
├── requirements.txt         # Python dependencies configuration
├── .gitignore              # Ignored files (virtual envs, cache, IDE files)
├── README.md               # Project documentation
├── templates/
│   └── index.html          # Core single-page interface
└── static/
    ├── css/
    │   └── style.css       # Custom styling (Dark/Light themes)
    └── js/
        └── app.js          # App state manager & event handling
```

---

## 🚀 Getting Started

### 1. Prerequisites
Make sure you have Python 3 installed on your machine.

### 2. Clone & Setup
Clone the repository and navigate into the project directory:
```bash
git clone https://github.com/HaiLam204/HaiLam204-event-talks-app.git
cd HaiLam204-event-talks-app
```

### 3. Install Dependencies
Install the required packages using pip:
```bash
pip install -r requirements.txt
```

### 4. Run the Server
Launch the Flask development server:
```bash
python app.py
```

Open your web browser and navigate to **[http://127.0.0.1:5000](http://127.0.0.1:5000)**.

---

## 🔄 How the Data Flows

1. The client browser loads the web UI.
2. The browser makes an AJAX fetch request to `/api/releases`.
3. The server checks the local cache:
   - If `feed_cache.json` exists and was modified less than 5 minutes ago, it serves cached data.
   - If not (or if forced via `?refresh=true`), the server fetches Google's XML feed, parses the individual `<h3>` blocks, updates the cache, and sends JSON back.
4. The frontend JavaScript calculates the statistics, builds the filter pills, and groups cards by date in a scrollable timeline.
5. Users select items, compose their tweets in the X-like mockup, and post them.
