// utils/youtube.js

const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();

// Build a list of progressively simpler queries to try, without duplicates.
const buildQueryVariants = (query) => {
    const base = normalize(query);
    const words = base.split(' ');

    const variants = [
        base,
        `${base} tutorial`,
        words.slice(0, 6).join(' '),
        `${words.slice(0, 4).join(' ')} tutorial`,
    ]
        .map(normalize)
        .filter(Boolean);

    return [...new Set(variants.map((q) => q.toLowerCase()))].map((lower) =>
        variants.find((q) => q.toLowerCase() === lower)
    );
};

// options.strict = true -> search ONLY the exact query (no added words, no fallbacks).
const searchYouTube = async (query, existingVideoIds = [], options = {}) => {
    const { strict = false } = options;

    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
        throw new Error('YOUTUBE_API_KEY is missing from environment variables.');
    }

    if (!normalize(query)) {
        throw new Error('A YouTube search query is required.');
    }

    const excludedIds = new Set((existingVideoIds || []).filter(Boolean));
    const queries = strict ? [normalize(query)] : buildQueryVariants(query);

    for (const searchQuery of queries) {
        console.log(`[YouTube] Searching for: "${searchQuery}"`);

        const params = new URLSearchParams({
            part: 'snippet',
            type: 'video',
            videoEmbeddable: 'true',
            safeSearch: 'moderate',
            relevanceLanguage: 'en',
            maxResults: '15',
            q: searchQuery,
            key: apiKey,
        });

        let response;
        let data;

        try {
            response = await fetch(
                `https://www.googleapis.com/youtube/v3/search?${params}`
            );
            data = await response.json();
        } catch (error) {
            // Network / parsing problem: try the next query variant.
            console.error('[YouTube] Network error:', error.message);
            continue;
        }

        // Real API problems (bad key, quota exceeded, etc.) should stop immediately.
        if (!response.ok) {
            const message =
                data?.error?.message ||
                `YouTube API request failed: ${response.status}`;
            console.error('[YouTube] API error:', message);
            throw new Error(message);
        }

        const items = data.items || [];

        console.log(
            `[YouTube] ${items.length} results returned, ${excludedIds.size} excluded IDs`
        );

        const selectedItem = items.find((item) => {
            const videoId = item.id?.videoId;
            return videoId && !excludedIds.has(videoId);
        });

        if (!selectedItem) {
            console.log(`[YouTube] No unused video found for "${searchQuery}".`);
            continue;
        }

        const videoId = selectedItem.id.videoId;

        const video = {
            videoId,
            title: selectedItem.snippet.title,
            channelTitle: selectedItem.snippet.channelTitle,
            thumbnail:
                selectedItem.snippet.thumbnails?.high?.url ||
                selectedItem.snippet.thumbnails?.medium?.url ||
                selectedItem.snippet.thumbnails?.default?.url ||
                '',
            embedUrl: `https://www.youtube.com/embed/${videoId}`,
            videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
        };

        console.log(`[YouTube] Selected video: "${video.title}"`);

        return video;
    }

    return null;
};

export default { searchYouTube };