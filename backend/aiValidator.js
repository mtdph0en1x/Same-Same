const Groq = require('groq-sdk');
require('dotenv').config();

// Will only initialize if key is present
const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

/**
 * Validates whether a list of words fit a specific category.
 * @param {string} category The category prompt (e.g., "Things in a gym")
 * @param {string[]} words An array of unique words submitted by players
 * @returns {Promise<Object>} A map of lowercase word to boolean. e.g. { "treadmill": true, "apple": false }
 */
async function validateWords(category, words) {
    if (!words || words.length === 0) return {};
    
    // If we don't have an API key, just approve everything so the game doesn't crash
    if (!groq) {
        console.warn('GROQ_API_KEY missing. Skipping AI validation.');
        return words.reduce((acc, w) => ({ ...acc, [w.toLowerCase()]: true }), {});
    }

    try {
        const prompt = `You are a STRICT party game judge. The category is: "${category}". 
Below are answers submitted by players. For each answer, determine if it is a VALID, LOGICAL, and ACCURATE fit for the category. 
- "fish" or "banana" might be grillable, but is "bicycle" or "car"? No. 
- Complete gibberish or unrelated words MUST be marked as false.
- Be highly critical. If the word makes no sense for the category, mark it false.

Return ONLY a valid JSON object where the keys are the exact submitted words (in lowercase), and the values are boolean true/false.
Example:
{"treadmill": true, "asdfgh": false, "water bottle": true, "jupiter": false}

Answers to judge: ${JSON.stringify(words)}`;

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: 'You output JSON only. You are a strict JSON party game judge. Reject unrelated answers.' },
                { role: 'user', content: prompt }
            ],
            model: 'llama-3.3-70b-versatile', // Upgraded to latest supported 70B model
            response_format: { type: 'json_object' },
            temperature: 0.0, // 0 for max determinism
        });

        const resultText = chatCompletion.choices[0].message.content;
        console.log('[AI Validator] Raw response:', resultText);
        const resultJson = JSON.parse(resultText);
        
        // Ensure all keys are lowercase to match scoring logic easily
        const lowercasedResult = {};
        for (const [k, v] of Object.entries(resultJson)) {
            lowercasedResult[k.toLowerCase()] = v;
        }
        console.log('[AI Validator] Parsed:', lowercasedResult);
        return lowercasedResult;

    } catch (err) {
        console.error('[AI Validator] Groq AI Validation Error:', err.message || err);
        // Fail open: if API fails, give them the points to not ruin the game flow
        return words.reduce((acc, w) => ({ ...acc, [w.toLowerCase()]: true }), {});
    }
}

module.exports = { validateWords };
