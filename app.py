import os
import re
import time
import urllib.request
import xml.etree.ElementTree as ET
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# Cache configuration
CACHE_FILE = "feed_cache.json"
CACHE_DURATION = 300  # 5 minutes in seconds
FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def clean_html_to_text(html_content):
    """Remove HTML tags and normalize whitespace for Twitter/X sharing."""
    # Replace links with text (href can be ignored or handled, but keep simple)
    text = re.sub(r'<[^>]+>', '', html_content)
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def truncate_for_tweet(date, category, text, url):
    """Generate tweet text within Twitter's 280 character limit, accounting for X's link wrapping (23 chars)."""
    prefix = f"BigQuery Release ({date}) [{category}]: "
    # X/Twitter wraps all URLs to 23 characters
    link_len = 23
    # 280 - prefix length - space before link - link length
    available_chars = 280 - len(prefix) - 1 - link_len
    
    if len(text) > available_chars:
        # Truncate text and add ellipsis
        truncated_text = text[:available_chars - 3].strip() + "..."
    else:
        truncated_text = text
        
    return f"{prefix}{truncated_text} {url}"

def parse_release_notes(xml_data):
    """Parse Atom XML feed and split entry content by <h3> headers into individual items."""
    try:
        root = ET.fromstring(xml_data)
    except ET.ParseError as e:
        print(f"XML Parsing Error: {e}")
        return []

    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    items = []
    
    # Process each <entry> in the Atom feed
    for entry in root.findall('atom:entry', ns):
        title = entry.find('atom:title', ns)
        date_str = title.text if title is not None else "Unknown Date"
        
        updated_el = entry.find('atom:updated', ns)
        updated_val = updated_el.text if updated_el is not None else ""
        
        link_el = entry.find('atom:link', ns)
        link_url = ""
        if link_el is not None:
            link_url = link_el.attrib.get('href', '')
        if not link_url:
            # Fallback if href isn't in attrib
            link_url = "https://cloud.google.com/bigquery/docs/release-notes"
            
        content_el = entry.find('atom:content', ns)
        content_html = content_el.text if content_el is not None else ""
        
        # Split content_html by <h3> tags
        h3_matches = list(re.finditer(r'<h3>(.*?)</h3>', content_html, re.IGNORECASE))
        
        if not h3_matches:
            # Fallback: if there are no <h3> headers, treat the entire content as one item of category "Release"
            plain_text = clean_html_to_text(content_html)
            item_id = f"item_{hash(date_str + '_0')}"
            items.append({
                "id": item_id,
                "date": date_str,
                "updated": updated_val,
                "link": link_url,
                "category": "Release",
                "content_html": content_html,
                "content_text": plain_text,
                "tweet_text": truncate_for_tweet(date_str, "Release", plain_text, link_url)
            })
        else:
            for idx, match in enumerate(h3_matches):
                category = match.group(1).strip()
                start_idx = match.end()
                end_idx = h3_matches[idx+1].start() if idx + 1 < len(h3_matches) else len(content_html)
                item_content_html = content_html[start_idx:end_idx].strip()
                
                plain_text = clean_html_to_text(item_content_html)
                item_id = f"item_{hash(date_str + '_' + str(idx) + '_' + category)}"
                
                # Make sure the category has a clean name (e.g. capitalize)
                category_display = category.title()
                
                items.append({
                    "id": item_id,
                    "date": date_str,
                    "updated": updated_val,
                    "link": link_url,
                    "category": category_display,
                    "content_html": item_content_html,
                    "content_text": plain_text,
                    "tweet_text": truncate_for_tweet(date_str, category_display, plain_text, link_url)
                })
                
    return items

def fetch_feed_data(bypass_cache=False):
    """Fetch from BigQuery release notes feed URL and cache results."""
    # Check if cache exists and is fresh
    if not bypass_cache and os.path.exists(CACHE_FILE):
        file_time = os.path.getmtime(CACHE_FILE)
        if time.time() - file_time < CACHE_DURATION:
            try:
                with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                    import json
                    print("Serving from cache.")
                    return json.load(f), "cache"
            except Exception as e:
                print(f"Error reading cache: {e}")

    # Fetch fresh data
    print("Fetching fresh data from feed.")
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        req = urllib.request.Request(FEED_URL, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as response:
            xml_data = response.read()
        
        parsed_items = parse_release_notes(xml_data.decode('utf-8'))
        
        # Write to cache
        if parsed_items:
            try:
                with open(CACHE_FILE, 'w', encoding='utf-8') as f:
                    import json
                    json.dump(parsed_items, f, ensure_ascii=False, indent=2)
            except Exception as e:
                print(f"Error writing cache: {e}")
                
        return parsed_items, "live"
    except Exception as e:
        print(f"Fetch failed: {e}")
        # Try returning old cache if available
        if os.path.exists(CACHE_FILE):
            try:
                with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                    import json
                    return json.load(f), "stale_cache"
            except:
                pass
        raise e

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    bypass_cache = request.args.get('refresh', 'false').lower() == 'true'
    try:
        items, source = fetch_feed_data(bypass_cache=bypass_cache)
        return jsonify({
            "status": "success",
            "source": source,
            "count": len(items),
            "data": items
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
