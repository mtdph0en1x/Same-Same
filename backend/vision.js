const vision = require('@google-cloud/vision');

// Initialize the Google Cloud Vision client
// It will automatically look for GOOGLE_APPLICATION_CREDENTIALS in the environment
// Or we can explicitly pass the JSON credentials if provided as a string
let client;

try {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    client = new vision.ImageAnnotatorClient({ credentials });
  } else {
    client = new vision.ImageAnnotatorClient(); // Fallback to standard GOOGLE_APPLICATION_CREDENTIALS path
  }
} catch (err) {
  console.warn("Google Vision API client failed to initialize. Make sure GOOGLE_APPLICATION_CREDENTIALS_JSON is set.", err.message);
}

/**
 * Checks an image against Google SafeSearch
 * @param {string} base64Image - The raw base64 string (without the data:image/jpeg;base64, prefix)
 * @returns {Promise<{isSafe: boolean, reason?: string}>}
 */
async function checkImageSafety(base64Image) {
  if (!client) {
    console.error("Google Vision API is not configured! Failing safe.");
    return { isSafe: false, reason: "Server configuration error: Vision API missing." };
  }

  try {
    const request = {
      image: { content: base64Image },
      features: [{ type: 'SAFE_SEARCH_DETECTION' }],
    };

    const [result] = await client.annotateImage(request);
    const safeSearch = result.safeSearchAnnotation;

    if (!safeSearch) {
      throw new Error("No SafeSearch data returned from Google API.");
    }

    const badLabels = ['LIKELY', 'VERY_LIKELY'];

    if (
      badLabels.includes(safeSearch.adult) ||
      badLabels.includes(safeSearch.violence) ||
      badLabels.includes(safeSearch.racy) ||
      badLabels.includes(safeSearch.medical) ||
      badLabels.includes(safeSearch.spoof)
    ) {
      return { 
        isSafe: false, 
        reason: `Image rejected. Detected: Adult(${safeSearch.adult}), Violence(${safeSearch.violence}), Racy(${safeSearch.racy})`
      };
    }

    return { isSafe: true };
  } catch (error) {
    console.error("Vision API Error:", error);
    return { isSafe: false, reason: "Error analyzing image safety." };
  }
}

module.exports = {
  checkImageSafety
};
