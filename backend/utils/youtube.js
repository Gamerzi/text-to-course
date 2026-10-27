/**
 * Standalone YouTube search utility using YouTube Data API v3
 * 
 * @param {string} query - Specific topic to search (e.g., "Python NumPy Arrays")
 * @param {Array<string>} existingVideoIds - Optional list of video IDs to avoid repeats
 * @returns {Promise<Object|null>} - Returns unique video details or null if not found
 */
const searchYouTube = async (query, existingVideoIds = []) => {
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
        console.warn('⚠️ No YOUTUBE_API_KEY in .env. Skipping YouTube search.');
        return null;
    }

    try {
        // Laser-focused educational search query
        const encodedQuery = encodeURIComponent(`${query} tutorial`);
        // Fetch top 5 results so we can pick a unique, high-quality video
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=5&q=${encodedQuery}&key=${apiKey}`;

        console.log(`🎥 [YouTube Util] Searching: "${query}"...`);
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            console.error('❌ YouTube API error:', data.error?.message || response.statusText);
            return null;
        }

        if (!data.items || data.items.length === 0) {
            console.log('⚠️ No YouTube video found for this query.');
            return null;
        }

        // 🛡️ ZERO DUPLICATES: Pick the first video whose ID hasn't been used yet
        const uniqueItem = data.items.find(
            (item) => !existingVideoIds.includes(item.id.videoId)
        ) || data.items[0];

        const videoId = uniqueItem.id.videoId;

        const videoResult = {
            videoId,
            title: uniqueItem.snippet.title,
            channelTitle: uniqueItem.snippet.channelTitle,
            thumbnail: uniqueItem.snippet.thumbnails?.high?.url || uniqueItem.snippet.thumbnails?.medium?.url,
            embedUrl: `https://www.youtube.com/embed/${videoId}`,
            videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
        };

        console.log(`✅ [YouTube Util] Found Unique: "${videoResult.title}" (${videoResult.videoUrl})`);
        return videoResult;
    } catch (error) {
        console.error('❌ YouTube search failed:', error.message);
        return null;
    }
};

// Export as default
export default {
    searchYouTube,
};