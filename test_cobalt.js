async function testCobalt() {
  const url = 'https://api.cobalt.tools/api/json';
  const postUrl = 'https://www.instagram.com/reel/DZ-jx88uz7i/';
  
  try {
    console.log("Querying Cobalt for:", postUrl);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: postUrl,
        filenamePattern: 'basic',
        isAudioOnly: false,
        isNoTTWatermark: true
      })
    });
    
    console.log("Status:", response.status);
    const data = await response.json();
    console.log("Response data:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Cobalt query failed:", err);
  }
}

testCobalt();
