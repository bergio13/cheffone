const fs = require('fs');
const html = fs.readFileSync('instagram_embed.html', 'utf8');

// Look for Caption elements
console.log("Searching for captions in html...");

// Often Instagram embed embeds JSON data in window._sharedData or a script tag
// Or the caption is inside a div with class "Caption"
const captionMatches = html.match(/<div[^>]+class=["'][^"']*Caption[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ||
                       html.match(/<span[^>]+class=["'][^"']*CaptionText[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);

if (captionMatches) {
  console.log("Found caption element in HTML! Length:", captionMatches[0].length);
  console.log("Snippet:", captionMatches[1].substring(0, 500));
} else {
  console.log("No standard caption element found by class.");
}

// Let's search for the word orange and print characters around it
const orangeIdx = html.toLowerCase().indexOf('orange');
if (orangeIdx !== -1) {
  console.log("\nFound 'orange' at index", orangeIdx);
  console.log("Snippet around 'orange':");
  console.log(html.substring(orangeIdx - 100, orangeIdx + 200));
}
