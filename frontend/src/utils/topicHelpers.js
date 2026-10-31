export const TOPIC_RULES = [
    { match: /kubernetes|\bk8s\b/i, glyph: "☸", hue: 220 },
    { match: /docker/i, glyph: "🐳", hue: 200 },
    { match: /typescript/i, glyph: "TS", hue: 215 },
    { match: /javascript|\bjs\b/i, glyph: "JS", hue: 48 },
    { match: /react|next.?js|redux/i, glyph: "⚛", hue: 190 },
    { match: /node.?js|express/i, glyph: "⬡", hue: 125 },
    { match: /python|django|flask/i, glyph: "🐍", hue: 140 },
    { match: /\bjava\b|spring/i, glyph: "☕", hue: 25 },
    { match: /c\+\+|cpp/i, glyph: "C++", hue: 210 },
    { match: /\bc#|csharp|\.net/i, glyph: "C#", hue: 275 },
    { match: /html|css|frontend|front-end|web design/i, glyph: "</>", hue: 330 },
    { match: /sql|database|mongo|postgres|dbms/i, glyph: "▤", hue: 175 },
    { match: /git|github/i, glyph: "⑂", hue: 15 },
    { match: /devops|cloud|aws|azure/i, glyph: "☁", hue: 225 },
    { match: /algorithm|data structure|\bdsa\b|linked list|graph|tree/i, glyph: "⌘", hue: 290 },
    { match: /machine learning|deep learning|artificial intelligence|\bai\b/i, glyph: "✳", hue: 265 },
    { match: /cybersecurity|security|hacking|network/i, glyph: "🛡", hue: 350 },

    { match: /plant|garden|botany|flower|agriculture|forest/i, glyph: "🌿", hue: 125 },
    { match: /space|universe|astronomy|planet|galaxy|nasa/i, glyph: "🪐", hue: 255 },
    { match: /physics|quantum|mechanics/i, glyph: "⚛", hue: 195 },
    { match: /chemistry|chemical/i, glyph: "🧪", hue: 165 },
    { match: /biology|human body|genetics|anatomy/i, glyph: "🧬", hue: 325 },
    { match: /environment|climate|global warming|sustainability/i, glyph: "🌍", hue: 155 },
    { match: /ocean|marine|sea life/i, glyph: "🌊", hue: 200 },
    { match: /animal|wildlife|zoology/i, glyph: "🦋", hue: 45 },

    { match: /current affairs|breaking news|world news/i, glyph: "📰", hue: 15 },
    { match: /history|ancient|civilization|archaeology/i, glyph: "🏛", hue: 35 },
    { match: /geography|countries|maps|continents/i, glyph: "🗺", hue: 180 },
    { match: /politics|government|constitution|civics/i, glyph: "⚖", hue: 220 },
    { match: /economics|finance|investing|stock market/i, glyph: "📈", hue: 145 },
    { match: /business|marketing|entrepreneur|startup/i, glyph: "💼", hue: 30 },
    { match: /math|calculus|statistics|probability/i, glyph: "∑", hue: 205 },
    { match: /psychology|philosophy|mindfulness/i, glyph: "🧠", hue: 285 },
    { match: /language|english|grammar|writing|literature/i, glyph: "✍", hue: 315 },
    { match: /music|piano|guitar|singing/i, glyph: "🎵", hue: 330 },
    { match: /\bart\b|drawing|painting|design|photography/i, glyph: "🎨", hue: 345 },
    { match: /cooking|recipe|food|baking/i, glyph: "🍳", hue: 20 },
    { match: /fitness|workout|yoga|sports/i, glyph: "🏃", hue: 95 },
    { match: /travel|tourism|culture/i, glyph: "✈", hue: 210 },
];

export const FALLBACK_HUES = [175, 205, 260, 320, 20, 95, 230, 350];

export const hashString = (value = "") => {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    }
    return hash;
};

export const getInitials = (title = "") => {
    const words = title.replace(/[^\w\s]/g, "").trim().split(/\s+/).filter(Boolean);
    return words.length
        ? words.slice(0, 2).map((word) => word[0].toUpperCase()).join("")
        : "?";
};

export const getTopicLogo = (title = "") => {
    const rule = TOPIC_RULES.find((item) => item.match.test(title));
    if (rule) return { ...rule, fallback: false };
    return {
        glyph: getInitials(title),
        hue: FALLBACK_HUES[hashString(title) % FALLBACK_HUES.length],
        fallback: true,
    };
};

