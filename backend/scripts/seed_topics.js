const fs = require('fs');
const path = require('path');
const { supabase } = require('../supabase');

async function seedTopics() {
    const categoriesDir = path.join(__dirname, '..', 'categories');
    
    // Read all JSON files
    const files = fs.readdirSync(categoriesDir).filter(f => f.endsWith('.json'));
    
    let totalInserted = 0;

    for (const file of files) {
        const packId = file.replace('.json', '');
        const topics = JSON.parse(fs.readFileSync(path.join(categoriesDir, file), 'utf8'));
        
        console.log(`Processing pack '${packId}' with ${topics.length} topics...`);
        
        // Prepare batches to avoid huge payloads
        const batchSize = 100;
        for (let i = 0; i < topics.length; i += batchSize) {
            const batch = topics.slice(i, i + batchSize).map(topicText => ({
                pack_id: packId,
                lang: 'en',
                topic: topicText
            }));

            const { data, error } = await supabase
                .from('topics')
                .insert(batch);
                
            if (error) {
                console.error(`Error inserting batch for ${packId}:`, error);
            } else {
                totalInserted += batch.length;
                console.log(`  Inserted ${batch.length} topics (${i + batch.length}/${topics.length})`);
            }
        }
    }

    console.log(`\nSuccess! Seeded a total of ${totalInserted} topics to Supabase.`);
    process.exit(0);
}

seedTopics().catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
});
