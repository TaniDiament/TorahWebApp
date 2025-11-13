/**
 * TorahWeb.org Website Scraper
 * This script scrapes the website and saves HTML files to ScrapedHTML folder
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const BASE_URL = 'https://torahweb.org';
const OUTPUT_DIR = path.join(__dirname, 'ScrapedHTML');
const MAX_PAGES = 100; // Limit to prevent infinite scraping
const DELAY_MS = 1000; // Delay between requests to be respectful

// Track visited URLs to avoid duplicates
const visitedUrls = new Set();
const urlQueue = [BASE_URL];

// Create output directory if it doesn't exist
function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`Created directory: ${dirPath}`);
    }
}

// Sleep function for delays
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Sanitize filename
function sanitizeFilename(url) {
    const urlObj = new URL(url);
    let filename = urlObj.pathname;

    // Replace / with _ and remove leading/trailing slashes
    filename = filename.replace(/^\/|\/$/g, '').replace(/\//g, '_');

    // If empty (homepage), use index
    if (!filename) {
        filename = 'index';
    }

    // Add .html extension if not present
    if (!filename.endsWith('.html') && !filename.endsWith('.htm')) {
        filename += '.html';
    }

    // Remove invalid characters
    filename = filename.replace(/[<>:"|?*]/g, '_');

    return filename;
}

// Check if URL is valid and belongs to the same domain
function isValidUrl(url, baseUrl) {
    try {
        const urlObj = new URL(url, baseUrl);
        const baseUrlObj = new URL(baseUrl);

        // Only scrape URLs from the same domain
        return urlObj.hostname === baseUrlObj.hostname;
    } catch (e) {
        return false;
    }
}

// Extract all links from HTML
function extractLinks(html, baseUrl) {
    const $ = cheerio.load(html);
    const links = new Set();

    $('a[href]').each((i, element) => {
        const href = $(element).attr('href');
        if (href) {
            try {
                const absoluteUrl = new URL(href, baseUrl).href;
                if (isValidUrl(absoluteUrl, BASE_URL)) {
                    // Remove fragments
                    const urlWithoutFragment = absoluteUrl.split('#')[0];
                    links.add(urlWithoutFragment);
                }
            } catch (e) {
                // Invalid URL, skip
            }
        }
    });

    return Array.from(links);
}

// Download and save a page
async function scrapePage(url) {
    if (visitedUrls.has(url) || visitedUrls.size >= MAX_PAGES) {
        return;
    }

    visitedUrls.add(url);
    console.log(`Scraping [${visitedUrls.size}/${MAX_PAGES}]: ${url}`);

    try {
        // Fetch the page
        const response = await axios.get(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const html = response.data;

        // Save the HTML file
        const filename = sanitizeFilename(url);
        const filepath = path.join(OUTPUT_DIR, filename);
        fs.writeFileSync(filepath, html, 'utf-8');
        console.log(`  ✓ Saved: ${filename}`);

        // Extract and queue new links
        const links = extractLinks(html, url);
        console.log(`  Found ${links.length} links on this page`);

        for (const link of links) {
            if (!visitedUrls.has(link) && !urlQueue.includes(link)) {
                urlQueue.push(link);
            }
        }

        // Save a metadata file with URL mapping
        const metadataFile = path.join(OUTPUT_DIR, '_url_mapping.json');
        let metadata = {};
        if (fs.existsSync(metadataFile)) {
            metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf-8'));
        }
        metadata[filename] = {
            url: url,
            scrapedAt: new Date().toISOString(),
            linksFound: links.length
        };
        fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2), 'utf-8');

    } catch (error) {
        console.error(`  ✗ Error scraping ${url}:`, error.message);
    }

    // Delay before next request
    await sleep(DELAY_MS);
}

// Main scraping function
async function main() {
    console.log('='.repeat(60));
    console.log('TorahWeb.org Website Scraper');
    console.log('='.repeat(60));
    console.log(`Base URL: ${BASE_URL}`);
    console.log(`Output Directory: ${OUTPUT_DIR}`);
    console.log(`Max Pages: ${MAX_PAGES}`);
    console.log('='.repeat(60));
    console.log();

    // Create output directory
    ensureDirectoryExists(OUTPUT_DIR);

    // Process queue
    while (urlQueue.length > 0 && visitedUrls.size < MAX_PAGES) {
        const url = urlQueue.shift();
        await scrapePage(url);
    }

    console.log();
    console.log('='.repeat(60));
    console.log('Scraping Complete!');
    console.log(`Total pages scraped: ${visitedUrls.size}`);
    console.log(`Files saved to: ${OUTPUT_DIR}`);
    console.log('='.repeat(60));
}

// Run the scraper
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});

