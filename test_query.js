async function testQuery() {
  // Try two variants of the unofficial public JSON API
  const codes = ['DZ-jx88uz7i'];
  for (const code of codes) {
    const urls = [
      `https://www.instagram.com/p/${code}/?__a=1&__d=dis`,
      `https://www.instagram.com/p/${code}/?__a=1&__d=1`,
      `https://www.instagram.com/reel/${code}/?__a=1&__d=1`
    ];
    
    for (const url of urls) {
      try {
        console.log("\nFetching query endpoint:", url);
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.instagram.com/',
            'Sec-Fetch-Mode': 'cors',
            'X-IG-App-ID': '936619743392459' // Common public Instagram App ID
          }
        });
        
        console.log("Status:", response.status);
        const text = await response.text();
        console.log("Response snippet (first 300 chars):", text.substring(0, 300));
        
        if (response.ok && text.trim().startsWith('{')) {
          const data = JSON.parse(text);
          console.log("Success! Found JSON payload.");
          // Look for caption inside the JSON structure
          // Typically: items[0].edge_media_to_caption.edges[0].node.text
          // or graphql.shortcode_media.edge_media_to_caption.edges[0].node.text
          console.log("Keys:", Object.keys(data));
          fs.writeFileSync('instagram_query.json', JSON.stringify(data, null, 2));
          break;
        }
      } catch (err) {
        console.error("Query failed:", err);
      }
    }
  }
}

const fs = require('fs');
testQuery();
