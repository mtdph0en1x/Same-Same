require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, error } = await supabase.from('topics').select('lang');
    if (error) console.error(error);
    const langs = data.reduce((acc, row) => {
        acc[row.lang] = (acc[row.lang] || 0) + 1;
        return acc;
    }, {});
    console.log("Supabase topics by language:", langs);
}
check();
