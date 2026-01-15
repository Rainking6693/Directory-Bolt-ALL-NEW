import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ScrapedData {
    title: string;
    description: string;
    h1: string[];
    links: string[];
    emails: string[];
    socialLinks: string[];
    text: string;
}

export async function scrapeWebsite(url: string): Promise<ScrapedData> {
    try {
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 10000
        });

        const $ = cheerio.load(data);

        const title = $('title').text().trim();
        const description = $('meta[name="description"]').attr('content') || '';
        const h1 = $('h1').map((_, el) => $(el).text().trim()).get();
        const links = $('a').map((_, el) => $(el).attr('href')).get().filter(Boolean);

        const bodyText = $('body').text().replace(/\s+/g, ' ').trim();

        // Simple email regex
        const emails = bodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];

        // Social links deduction
        const socialPlatforms = ['facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com', 'youtube.com'];
        const socialLinks = links.filter(link => socialPlatforms.some(platform => link.includes(platform)));

        return {
            title,
            description,
            h1,
            links,
            emails: [...new Set(emails)],
            socialLinks: [...new Set(socialLinks)],
            text: bodyText.substring(0, 5000) // Truncate for AI context
        };
    } catch (error: any) {
        console.error(`Scraping failed for ${url}:`, error.message);
        throw new Error(`Failed to scrape ${url}: ${error.message}`);
    }
}
