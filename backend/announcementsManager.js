const supabase = require('./supabase');

let cachedAnnouncements = {
    newsItems: [],
    transmissions: []
};

let refreshInterval = null;

async function refreshAnnouncements() {
    try {
        const { data, error } = await supabase
            .from('announcements')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching announcements from Supabase:', error.message);
            return;
        }

        const newsItems = [];
        const transmissions = [];

        for (const row of data) {
            if (row.type === 'news') {
                newsItems.push(row.headline);
            } else if (row.type === 'transmission') {
                transmissions.push({
                    id: row.id,
                    dateLabel: row.date_label || '',
                    headline: row.headline || '',
                    body: row.body || '',
                });
            }
        }

        cachedAnnouncements = { newsItems, transmissions };
        console.log(`Announcements refreshed: ${newsItems.length} news items, ${transmissions.length} transmissions`);
    } catch (err) {
        console.error('Failed to refresh announcements:', err);
    }
}

function startAutoRefresh(intervalMs = 300000) { // Default 5 minutes
    if (refreshInterval) clearInterval(refreshInterval);
    refreshAnnouncements(); // Initial fetch
    refreshInterval = setInterval(refreshAnnouncements, intervalMs);
}

function getAnnouncements() {
    return cachedAnnouncements;
}

module.exports = {
    startAutoRefresh,
    getAnnouncements,
    refreshAnnouncements
};
