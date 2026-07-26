const fs = require('fs');
const path = require('path');
const { supabase } = require('../supabase');

async function seedTxtTopics() {
    const topicsDir = path.join(__dirname, '../../topics');
    const files = fs.readdirSync(topicsDir).filter(f => f.endsWith('.txt') && f.includes('_'));
    
    // Assuming filename format: packName_lang.txt
    const packsToClear = [...new Set(files.map(f => f.split('_')[0]))];
    
    console.log(`Clearing existing topics for packs: ${packsToClear.join(', ')}...`);
    for (const pack of packsToClear) {
        const { error } = await supabase.from('topics').delete().eq('pack_id', pack);
        if (error) console.error(`Error clearing pack ${pack}:`, error);
    }

    let totalInserted = 0;

    for (const file of files) {
        const [packId, langWithExt] = file.split('_');
        const lang = langWithExt.replace('.txt', '');
        
        const content = fs.readFileSync(path.join(topicsDir, file), 'utf8');
        const topics = content.split(/\r?\n/).map(t => t.trim()).filter(t => t.length > 0);
        
        console.log(`Processing pack '${packId}' for language '${lang}' with ${topics.length} topics...`);
        
        const batchSize = 100;
        for (let i = 0; i < topics.length; i += batchSize) {
            const batch = topics.slice(i, i + batchSize).map(topicText => ({
                pack_id: packId,
                lang: lang,
                topic: topicText
            }));

            const { data, error } = await supabase.from('topics').insert(batch);
            
            if (error) {
                console.error(`Error inserting batch for ${packId} (${lang}):`, error);
            } else {
                totalInserted += batch.length;
                console.log(`  Inserted ${batch.length} topics (${i + batch.length}/${topics.length})`);
            }
        }
    }

    console.log(`\nSuccess! Seeded a total of ${totalInserted} topics to Supabase.`);
    process.exit(0);
}

seedTxtTopics().catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
});
