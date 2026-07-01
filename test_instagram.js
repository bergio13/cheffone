async function run() {
  const url = 'https://www.instagram.com/reel/DZ-jx88uz7i/embed/captioned/';
  try {
    console.log("Fetching:", url);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    console.log("Status:", response.status);
    const text = await response.text();
    console.log("Response length:", text.length, "bytes");
    
    // Look for caption classes or contents
    // Let's write the response to a temp file to inspect
    const fs = require('fs');
    fs.writeFileSync('instagram_embed.html', text);
    console.log("Wrote html to instagram_embed.html");
    
    // Search for keywords related to the recipe (e.g. orange, pork, marinate)
    const hasPork = text.toLowerCase().includes('pork');
    const hasOrange = text.toLowerCase().includes('orange');
    console.log("Has pork?", hasPork);
    console.log("Has orange?", hasOrange);
  } catch (error) {
    console.error("Fetch failed:", error);
  }
}
run();
