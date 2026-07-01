const fs = require('fs');
const html = fs.readFileSync('instagram_embed.html', 'utf8');

const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
console.log("Title tag:", titleMatch ? titleMatch[1] : "None");

// Let's print the first 1000 characters of the body
const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
if (bodyMatch) {
  // strip script/style tags for printing
  const cleanBody = bodyMatch[1].replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '').replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '');
  console.log("\nClean Body (first 500 chars):");
  console.log(cleanBody.trim().substring(0, 500));
} else {
  console.log("No body element found.");
}
