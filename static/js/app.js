// State management
const state = {
    releases: [],
    selectedIds: new Set(),
    filters: {
        search: "",
        category: "all"
    },
    theme: "dark"
};

// DOM Elements
const elements = {
    refreshBtn: document.getElementById('refresh-btn'),
    refreshIcon: document.getElementById('refresh-icon'),
    themeToggle: document.getElementById('theme-toggle'),
    connectionStatus: document.getElementById('connection-status'),
    searchInput: document.getElementById('search-input'),
    clearSearchBtn: document.getElementById('clear-search-btn'),
    categoryFiltersContainer: document.getElementById('category-filters-container'),
    skeletonLoader: document.getElementById('skeleton-loader'),
    emptyState: document.getElementById('empty-state'),
    errorState: document.getElementById('error-state'),
    errorMessage: document.getElementById('error-message'),
    releaseFeed: document.getElementById('release-feed'),
    retryBtn: document.getElementById('retry-btn'),
    resetFiltersBtn: document.getElementById('reset-filters-btn'),
    
    // Stats
    statFeatures: document.getElementById('stat-features'),
    statIssues: document.getElementById('stat-issues'),
    statDeprecations: document.getElementById('stat-deprecations'),
    statTotal: document.getElementById('stat-total'),
    
    // Floating Selection Bar
    selectionBar: document.getElementById('selection-bar'),
    selectionCount: document.getElementById('selection-count'),
    btnTweetDigest: document.getElementById('btn-tweet-digest'),
    btnClearSelection: document.getElementById('btn-clear-selection'),
    
    // Modal
    tweetModal: document.getElementById('tweet-modal'),
    closeModalBtn: document.getElementById('close-modal-btn'),
    tweetTextarea: document.getElementById('tweet-textarea'),
    charCount: document.getElementById('char-count'),
    tweetWarningMsg: document.getElementById('tweet-warning-msg'),
    copyTweetBtn: document.getElementById('copy-tweet-btn'),
    publishTweetBtn: document.getElementById('publish-tweet-btn'),
    
    // Toast Container
    toastContainer: document.getElementById('toast-container')
};

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    setupEventListeners();
    fetchReleases();
});

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem("theme");
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    
    if (savedTheme) {
        state.theme = savedTheme;
    } else {
        state.theme = systemPrefersDark ? "dark" : "light";
    }
    
    document.documentElement.setAttribute("data-theme", state.theme);
}

function toggleTheme() {
    state.theme = state.theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", state.theme);
    localStorage.setItem("theme", state.theme);
}

// Toast Notifications
function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    
    let iconName = "check-circle";
    if (type === "error") iconName = "alert-octagon";
    else if (type === "info") iconName = "info";
    
    toast.innerHTML = `
        <i data-lucide="${iconName}"></i>
        <span>${message}</span>
    `;
    
    elements.toastContainer.appendChild(toast);
    lucide.createIcons();
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = "toast-enter 0.3s reverse ease-in";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Fetch Release Notes from API
async function fetchReleases(bypassCache = false) {
    showLoadingState(true);
    
    try {
        const url = `/api/releases${bypassCache ? '?refresh=true' : ''}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.status === "success") {
            state.releases = result.data;
            state.selectedIds.clear(); // Reset selection on fresh fetch
            
            // Update UI status badge
            updateStatusBadge(result.source);
            
            // Update stats counter
            calculateStats();
            
            // Render category filters
            renderCategoryFilters();
            
            // Render cards feed
            renderFeed();
            
            if (bypassCache) {
                showToast("Release notes successfully updated from feed!", "success");
            }
        } else {
            throw new Error(result.message || "Unknown error occurred while fetching notes.");
        }
    } catch (error) {
        console.error("Fetch error:", error);
        showErrorState(error.message);
        showToast("Failed to fetch release notes.", "error");
    } finally {
        showLoadingState(false);
    }
}

// UI States Control
function showLoadingState(isLoading) {
    if (isLoading) {
        elements.skeletonLoader.style.display = "block";
        elements.releaseFeed.style.display = "none";
        elements.emptyState.style.display = "none";
        elements.errorState.style.display = "none";
        elements.refreshIcon.classList.add("rotate-active");
        elements.refreshBtn.disabled = true;
        
        elements.connectionStatus.className = "status-badge loading";
        elements.connectionStatus.querySelector(".status-label").textContent = "Fetching...";
    } else {
        elements.skeletonLoader.style.display = "none";
        elements.refreshIcon.classList.remove("rotate-active");
        elements.refreshBtn.disabled = false;
    }
}

function showErrorState(message) {
    elements.errorMessage.textContent = message || "Could not fetch the feed. Please try again later.";
    elements.errorState.style.display = "flex";
    elements.releaseFeed.style.display = "none";
    elements.emptyState.style.display = "none";
}

function updateStatusBadge(source) {
    const badge = elements.connectionStatus;
    const label = badge.querySelector(".status-label");
    
    badge.className = "status-badge";
    
    if (source === "live") {
        badge.classList.add("live");
        label.textContent = "Live Feed";
    } else if (source === "cache") {
        badge.classList.add("cache");
        label.textContent = "Cached";
    } else {
        badge.classList.add("loading");
        label.textContent = "Offline (Cached)";
    }
}

// Calculate Stats dynamically
function calculateStats() {
    let features = 0;
    let issues = 0;
    let deprecations = 0;
    
    state.releases.forEach(item => {
        const cat = item.category.toLowerCase();
        if (cat.includes('feature')) features++;
        else if (cat.includes('issue') || cat.includes('resolved') || cat.includes('fix')) issues++;
        else if (cat.includes('deprecat')) deprecations++;
    });
    
    elements.statFeatures.textContent = features;
    elements.statIssues.textContent = issues;
    elements.statDeprecations.textContent = deprecations;
    elements.statTotal.textContent = state.releases.length;
}

// Generate dynamically category filter pills with counts
function renderCategoryFilters() {
    // Generate counts for each category
    const counts = { all: state.releases.length };
    
    state.releases.forEach(item => {
        const cat = item.category;
        counts[cat] = (counts[cat] || 0) + 1;
    });
    
    // Sort categories, placing common ones first
    const categories = Object.keys(counts).filter(c => c !== 'all');
    categories.sort((a, b) => counts[b] - counts[a]);
    
    // Create HTML for pills
    let html = `
        <button class="filter-pill ${state.filters.category === 'all' ? 'active' : ''}" data-category="all">
            All Updates <span style="opacity: 0.6; font-size: 11px; margin-left: 4px;">(${counts.all})</span>
        </button>
    `;
    
    categories.forEach(cat => {
        html += `
            <button class="filter-pill ${state.filters.category === cat ? 'active' : ''}" data-category="${cat}">
                ${cat} <span style="opacity: 0.6; font-size: 11px; margin-left: 4px;">(${counts[cat]})</span>
            </button>
        `;
    });
    
    elements.categoryFiltersContainer.innerHTML = html;
    
    // Re-attach listeners to pills
    document.querySelectorAll(".filter-pill").forEach(pill => {
        pill.addEventListener("click", (e) => {
            const btn = e.currentTarget;
            document.querySelectorAll(".filter-pill").forEach(p => p.classList.remove("active"));
            btn.classList.add("active");
            
            state.filters.category = btn.getAttribute("data-category");
            renderFeed();
        });
    });
}

// Filter and Render Feed
function renderFeed() {
    elements.releaseFeed.style.display = "block";
    elements.emptyState.style.display = "none";
    elements.errorState.style.display = "none";
    
    // 1. Filter releases
    const searchLower = state.filters.search.toLowerCase().trim();
    const activeCategory = state.filters.category;
    
    const filtered = state.releases.filter(item => {
        // Category check
        if (activeCategory !== "all" && item.category !== activeCategory) {
            return false;
        }
        
        // Search check
        if (searchLower) {
            const matchesSearch = 
                item.date.toLowerCase().includes(searchLower) ||
                item.category.toLowerCase().includes(searchLower) ||
                item.content_text.toLowerCase().includes(searchLower);
            return matchesSearch;
        }
        
        return true;
    });
    
    // 2. Empty state check
    if (filtered.length === 0) {
        elements.releaseFeed.innerHTML = "";
        elements.emptyState.style.display = "flex";
        return;
    }
    
    // 3. Group by date
    const grouped = {};
    filtered.forEach(item => {
        if (!grouped[item.date]) {
            grouped[item.date] = [];
        }
        grouped[item.date].push(item);
    });
    
    // 4. Render entries
    let html = "";
    
    // Preserve order (assumed already sorted newest first by feed, we just iterate in sequence)
    const dates = Object.keys(grouped);
    
    dates.forEach(date => {
        html += `<div class="timeline-date-header">${date}</div>`;
        html += `<div class="release-feed">`;
        
        grouped[date].forEach(item => {
            const isChecked = state.selectedIds.has(item.id);
            const categoryClass = getCategoryCSSClass(item.category);
            
            html += `
                <div class="release-card ${categoryClass} ${isChecked ? 'selected' : ''}" data-id="${item.id}">
                    <div class="release-card-header">
                        <div class="card-metadata">
                            <label class="card-selector">
                                <input type="checkbox" data-id="${item.id}" ${isChecked ? 'checked' : ''}>
                                <span class="checkbox-custom">
                                    <i data-lucide="check"></i>
                                </span>
                            </label>
                            <span class="badge">
                                <span class="badge-dot"></span>
                                ${item.category}
                            </span>
                            <span class="card-date">${item.date}</span>
                        </div>
                    </div>
                    
                    <div class="release-card-body">
                        ${item.content_html}
                    </div>
                    
                    <div class="release-card-footer">
                        <button class="btn btn-secondary btn-tweet share-card-btn" data-id="${item.id}">
                            <svg viewBox="0 0 24 24" class="x-logo-svg"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                            <span>Share Update</span>
                        </button>
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
    });
    
    elements.releaseFeed.innerHTML = html;
    
    // Re-initialize Lucide Icons for dynamic content
    lucide.createIcons();
    
    // Bind actions to card checkboxes & tweet buttons
    bindFeedEvents();
    updateSelectionBar();
}

function getCategoryCSSClass(category) {
    const cat = category.toLowerCase();
    if (cat.includes('feature')) return 'category-feature';
    if (cat.includes('issue') || cat.includes('resolved') || cat.includes('fix')) return 'category-issue';
    if (cat.includes('deprecat')) return 'category-deprecation';
    if (cat.includes('change') || cat.includes('update')) return 'category-changed';
    return 'category-other';
}

// Bind card actions
function bindFeedEvents() {
    // Checkbox changed
    elements.releaseFeed.querySelectorAll(".card-selector input").forEach(checkbox => {
        checkbox.addEventListener("change", (e) => {
            const id = e.currentTarget.getAttribute("data-id");
            const card = e.currentTarget.closest(".release-card");
            
            if (e.currentTarget.checked) {
                state.selectedIds.add(id);
                card.classList.add("selected");
            } else {
                state.selectedIds.delete(id);
                card.classList.remove("selected");
            }
            
            updateSelectionBar();
        });
    });
    
    // Individual Tweet button clicked
    elements.releaseFeed.querySelectorAll(".share-card-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const id = e.currentTarget.getAttribute("data-id");
            const item = state.releases.find(r => r.id === id);
            
            if (item) {
                openTweetComposer(item.tweet_text);
            }
        });
    });
}

// Floating Selection Bar updates
function updateSelectionBar() {
    const size = state.selectedIds.size;
    
    if (size > 0) {
        elements.selectionCount.textContent = size;
        elements.selectionBar.classList.add("active");
    } else {
        elements.selectionBar.classList.remove("active");
    }
}

// Tweet Composer Modal Controls
function openTweetComposer(text) {
    elements.tweetTextarea.value = text;
    elements.tweetModal.style.display = "flex";
    updateCharCounter();
    elements.tweetTextarea.focus();
}

function closeTweetComposer() {
    elements.tweetModal.style.display = "none";
}

function updateCharCounter() {
    const text = elements.tweetTextarea.value;
    
    // Handle URL lengths properly (X wraps all links to 23 characters)
    // Find URLs in text and adjust characters count
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = text.match(urlRegex) || [];
    
    let rawLength = text.length;
    let urlLengthAdjustment = 0;
    
    urls.forEach(url => {
        rawLength -= url.length; // Subtract actual URL length
        urlLengthAdjustment += 23; // Add standard X URL length
    });
    
    const finalLength = rawLength + urlLengthAdjustment;
    
    elements.charCount.textContent = finalLength;
    
    if (finalLength > 280) {
        elements.charCount.style.color = "rgb(244, 63, 94)";
        elements.tweetWarningMsg.style.display = "flex";
    } else {
        elements.charCount.style.color = "var(--text-muted)";
        elements.tweetWarningMsg.style.display = "none";
    }
}

// Compile multiple selected items into a single Digest Tweet
function compileDigestTweet() {
    if (state.selectedIds.size === 0) return;
    
    // Find all selected items
    const selectedItems = state.releases.filter(r => state.selectedIds.has(r.id));
    
    let tweet = "🚀 BigQuery Release Highlights:\n\n";
    selectedItems.forEach(item => {
        const bullet = `• [${item.category}] ${item.content_text}\n`;
        tweet += bullet;
    });
    
    tweet += "\nRead more here: https://cloud.google.com/bigquery/docs/release-notes";
    
    openTweetComposer(tweet);
}

// Set up event listeners
function setupEventListeners() {
    // Theme toggle
    elements.themeToggle.addEventListener("click", toggleTheme);
    
    // Refresh Button
    elements.refreshBtn.addEventListener("click", () => {
        fetchReleases(true);
    });
    
    // Retry Button
    elements.retryBtn.addEventListener("click", () => {
        fetchReleases(true);
    });
    
    // Reset Filters Button
    elements.resetFiltersBtn.addEventListener("click", () => {
        state.filters.search = "";
        state.filters.category = "all";
        elements.searchInput.value = "";
        elements.clearSearchBtn.style.display = "none";
        
        // Reset category pill styles
        document.querySelectorAll(".filter-pill").forEach(p => p.classList.remove("active"));
        const allPill = document.querySelector('.filter-pill[data-category="all"]');
        if (allPill) allPill.classList.add("active");
        
        renderFeed();
    });
    
    // Debounced Search Input
    let searchTimeout;
    elements.searchInput.addEventListener("input", (e) => {
        const val = e.target.value;
        elements.clearSearchBtn.style.display = val ? "block" : "none";
        
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            state.filters.search = val;
            renderFeed();
        }, 300);
    });
    
    // Clear Search Button
    elements.clearSearchBtn.addEventListener("click", () => {
        elements.searchInput.value = "";
        elements.clearSearchBtn.style.display = "none";
        state.filters.search = "";
        renderFeed();
        elements.searchInput.focus();
    });
    
    // Clear Selection Button
    elements.btnClearSelection.addEventListener("click", () => {
        state.selectedIds.clear();
        
        // Uncheck all check boxes in UI
        elements.releaseFeed.querySelectorAll(".card-selector input").forEach(cb => {
            cb.checked = false;
        });
        elements.releaseFeed.querySelectorAll(".release-card").forEach(card => {
            card.classList.remove("selected");
        });
        
        updateSelectionBar();
    });
    
    // Open Tweet Digest Composer
    elements.btnTweetDigest.addEventListener("click", compileDigestTweet);
    
    // Modal Close
    elements.closeModalBtn.addEventListener("click", closeTweetComposer);
    elements.tweetModal.addEventListener("click", (e) => {
        if (e.target === elements.tweetModal) {
            closeTweetComposer();
        }
    });
    
    // Textarea word counter listener
    elements.tweetTextarea.addEventListener("input", updateCharCounter);
    
    // Copy Tweet button
    elements.copyTweetBtn.addEventListener("click", () => {
        const text = elements.tweetTextarea.value;
        navigator.clipboard.writeText(text)
            .then(() => {
                showToast("Tweet text copied to clipboard!", "success");
            })
            .catch(err => {
                console.error("Copy failed:", err);
                showToast("Failed to copy text. Please copy manually.", "error");
            });
    });
    
    // Post to X Button
    elements.publishTweetBtn.addEventListener("click", () => {
        const text = elements.tweetTextarea.value;
        const encodedText = encodeURIComponent(text);
        const xUrl = `https://twitter.com/intent/tweet?text=${encodedText}`;
        
        // Open in new tab
        window.open(xUrl, '_blank', 'noopener,noreferrer');
        closeTweetComposer();
        showToast("Opened X / Twitter web intent window!", "success");
    });
}
