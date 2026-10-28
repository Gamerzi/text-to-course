
const searchYouTube = async (query, existingVideoIds = []) => {
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
        throw new Error('YOUTUBE_API_KEY is missing from environment variables.');
    }

    if (!query || !String(query).trim()) {
        throw new Error('A YouTube search query is required.');
    }

    const queries = [
        String(query).trim(),
        `${String(query).trim()} for beginners`,
    ];

    const excludedIds = new Set(existingVideoIds.filter(Boolean));

    for (const searchQuery of queries) {
        try {
            console.log(`[YouTube] Searching for: "${searchQuery}"`);

            const params = new URLSearchParams({
                part: 'snippet',
                type: 'video',
                videoEmbeddable: 'true',
                maxResults: '10',
                q: searchQuery,
                key: apiKey,
            });

            const response = await fetch(
                `https://www.googleapis.com/youtube/v3/search?${params}`
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error?.message ||
                    `YouTube API request failed: ${response.status}`
                );
            }

            const items = data.items || [];

            const selectedItem = items.find((item) => {
                const videoId = item.id?.videoId;
                return videoId && !excludedIds.has(videoId);
            });

            if (!selectedItem) {
                console.log(
                    `[YouTube] No unused video found for "${searchQuery}".`
                );
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
        } catch (error) {
            console.error('[YouTube] Search error:', error.message);
            throw error;
        }
    }

    return null;
};

export default { searchYouTube };
