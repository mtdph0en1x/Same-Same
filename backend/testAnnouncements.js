require('dotenv').config();
const { supabase } = require('./supabase');
const manager = require('./announcementsManager');

async function test() {
    console.log("Fetching...");
    await manager.refreshAnnouncements();
    console.log("Cached Data:", manager.getAnnouncements());
    process.exit(0);
}
test();
