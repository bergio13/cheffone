import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Robust helper to extract caption text from different RapidAPI JSON response styles
function extractCaptionFromJson(data) {
  if (!data) return '';
  
  if (typeof data.caption === 'string') return data.caption;
  if (typeof data.text === 'string') return data.text;
  if (typeof data.description === 'string') return data.description;
  if (typeof data.title === 'string') return data.title;
  
  if (data.data) {
    if (typeof data.data.caption === 'string') return data.data.caption;
    if (typeof data.data.text === 'string') return data.data.text;
    if (typeof data.data.description === 'string') return data.data.description;
    if (data.data.caption && typeof data.data.caption.text === 'string') return data.data.caption.text;
  }
  
  try {
    const edge = data.graphql?.shortcode_media?.edge_media_to_caption?.edges?.[0]?.node?.text;
    if (edge) return edge;
  } catch (e) {}

  return JSON.stringify(data);
}

// Simple crawler to extract basic metadata from a URL (with RapidAPI integration)
async function extractMetadata(url) {
  try {
    const isTikTok = url.includes('tiktok.com');
    const isInstagram = url.includes('instagram.com');

    // RapidAPI Scraper bypass if configured in .env.local
    const rapidApiKey = process.env.RAPIDAPI_KEY;
    const rapidApiEndpoint = process.env.RAPIDAPI_ENDPOINT;

    if (rapidApiKey && rapidApiEndpoint) {
      try {
        console.log(`Using RapidAPI to scrape URL: ${url}`);
        const cleanEndpoint = rapidApiEndpoint.endsWith('=') || rapidApiEndpoint.includes('?') ? rapidApiEndpoint : `${rapidApiEndpoint}?url=`;
        const fetchUrl = cleanEndpoint.endsWith('=') || cleanEndpoint.endsWith('?') ? `${cleanEndpoint}${encodeURIComponent(url)}` : `${cleanEndpoint}?url=${encodeURIComponent(url)}`;
        const host = new URL(cleanEndpoint).hostname;

        const response = await fetch(fetchUrl, {
          headers: {
            'x-rapidapi-key': rapidApiKey,
            'x-rapidapi-host': host
          },
          next: { revalidate: 3600 }
        });

        if (response.ok) {
          const data = await response.json();
          const caption = extractCaptionFromJson(data);
          if (caption) {
            console.log("RapidAPI successfully scraped caption! Length:", caption.length);
            return {
              title: data.title || '',
              description: caption,
              provider: isInstagram ? 'Instagram' : (isTikTok ? 'TikTok' : 'Web'),
              extractedText: caption
            };
          }
        } else {
          console.error(`RapidAPI request failed with status: ${response.status}`);
        }
      } catch (rapidError) {
        console.error("RapidAPI execution failed, falling back to basic scrapers:", rapidError);
      }
    }

    if (isTikTok) {
      // Use TikTok's official public oEmbed API
      const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
      const response = await fetch(oembedUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      if (response.ok) {
        const data = await response.json();
        return {
          title: data.title || '',
          author: data.author_name || '',
          provider: 'TikTok',
          htmlContent: data.html || '',
          rawMetadata: JSON.stringify(data)
        };
      }
    }

    // Fallback/Generic HTML Scraper for OpenGraph Metadata
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      next: { revalidate: 3600 } // cache for 1 hour
    });

    if (!response.ok) {
      return { title: '', description: '', error: `HTTP ${response.status}` };
    }

    const html = await response.text();
    
    // Extract OpenGraph/Twitter card/Description using regex to avoid heavy HTML parser libraries
    const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) || 
                         html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
    
    const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) || 
                        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
    
    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) || 
                      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);

    return {
      title: ogTitleMatch ? ogTitleMatch[1] : (titleMatch ? titleMatch[1] : ''),
      description: ogDescMatch ? ogDescMatch[1] : (descMatch ? descMatch[1] : ''),
      provider: isInstagram ? 'Instagram' : 'Web',
      extractedText: `Title: ${ogTitleMatch ? ogTitleMatch[1] : ''}. Description: ${ogDescMatch ? ogDescMatch[1] : ''}`
    };
  } catch (error) {
    console.error('Error extracting metadata:', error);
    return { error: error.message };
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { url, rawText } = body;

    const activeApiKey = process.env.GEMINI_API_KEY;

    if (!activeApiKey || activeApiKey === 'your_gemini_api_key_here') {
      return NextResponse.json(
        { error: 'Gemini API Key is missing on the server. Please configure GEMINI_API_KEY inside your .env.local file in the project root.' },
        { status: 400 }
      );
    }

    let sourceText = rawText || '';
    let extractedMeta = null;

    const isInstagramUrl = url && url.includes('instagram.com');
    const isRapidApiConfigured = process.env.RAPIDAPI_KEY && process.env.RAPIDAPI_ENDPOINT;

    if (isInstagramUrl && !sourceText.trim() && !isRapidApiConfigured) {
      return NextResponse.json(
        { error: 'Instagram links cannot be scraped automatically without a RapidAPI key configuration due to login walls. Please copy the caption/ingredients from the post and paste it into the fallback text area below, or add RAPIDAPI_KEY to your .env.local file to enable auto-scraping!' },
        { status: 400 }
      );
    }

    if (url && url.startsWith('http')) {
      extractedMeta = await extractMetadata(url);
      
      const isLoginWall = extractedMeta && !isRapidApiConfigured && (
        (extractedMeta.title && extractedMeta.title.toLowerCase().includes('login')) ||
        (extractedMeta.title === 'Instagram') ||
        (extractedMeta.description && extractedMeta.description.toLowerCase().includes('welcome back to instagram'))
      );

      if (extractedMeta && !extractedMeta.error && !isLoginWall) {
        const metaInfo = `[Metadata Extracted from Link]
Platform: ${extractedMeta.provider || 'Unknown'}
Title: ${extractedMeta.title || ''}
Description: ${extractedMeta.description || extractedMeta.title || ''}
${extractedMeta.author ? 'Creator: ' + extractedMeta.author : ''}`;
        
        sourceText = `${metaInfo}\n\n[User Copied Caption/Notes]\n${sourceText}`;
      } else if (isLoginWall && !sourceText.trim()) {
        return NextResponse.json(
          { error: 'Scraping was blocked by the platform login wall. Please copy the post caption/ingredients and paste it in the fallback text area below!' },
          { status: 400 }
        );
      }
    }

    if (!sourceText.trim()) {
      return NextResponse.json(
        { error: 'Please provide either a recipe link or paste details manually.' },
        { status: 400 }
      );
    }

    // Initialize Gemini API
    const genAI = new GoogleGenerativeAI(activeApiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json'
      }
    });

    const prompt = `You are an expert chef and culinary visualizer. Your task is to take this recipe caption, metadata, and description, structure it into a beautiful recipe card, and generate three hand-drawn/sketched-style SVGs representing different stages of the cooking process.

Source Content:
"""
${sourceText}
"""

Please respond with a JSON object that strictly adheres to the following JSON schema:
{
  "title": "Title of the recipe (make it sound premium)",
  "prepTime": "Preparation time, e.g., 10 mins (estimate if not present)",
  "cookTime": "Cooking time, e.g., 20 mins (estimate if not present)",
  "servings": 2,
  "difficulty": "Easy" | "Medium" | "Hard",
  "category": "Dinner" | "Breakfast" | "Dessert" | "Appetizer" | "Snack" | "Drink" | "Other",
  "description": "A compelling 1-2 sentence description of the dish, highlighting its appeal.",
  "ingredients": [
    {
      "name": "Name of ingredient, e.g., Olive Oil",
      "quantity": 2.5, // numeric value (or null if taste/to serve)
      "unit": "tbsp" // e.g., g, ml, tbsp, tsp, piece, cup, or "" if count
    }
  ],
  "instructions": [
    "Step-by-step cooking instruction 1",
    "Step-by-step cooking instruction 2"
  ],
  "nutrition": {
    "calories": 450, // estimated calories per serving
    "protein": "25g", // estimated protein per serving
    "carbs": "40g", // estimated carbs per serving
    "fat": "15g", // estimated fat per serving
    "fiber": "4g" // estimated fiber per serving (optional, null if unsure)
  },
  "sketches": {
    "ingredients": "Valid, inline SVG string representing the raw ingredients or prepped setup (e.g. carrots, onions, cutting board, oil bottle). Do not use external files or fonts. Must scale responsively with viewBox='0 0 400 400' and no static width/height. Use stylized stroke-based sketch shapes. Use #d97706 for highlight elements, #57534e for dark sketch strokes, and #eae5dc for fills or accents.",
    "process": "Valid, inline SVG string representing the active cooking phase (e.g. pot boiling, whisk in a bowl, pan on flames, spatula stirring). Must follow the same style and color constraints with viewBox='0 0 400 400'.",
    "finished": "Valid, inline SVG string representing the final plated dish (e.g. pasta bowl with steam, sandwich cut in half, soup, dessert). Must follow the same style and color constraints with viewBox='0 0 400 400'."
  }
}

SVG Guidelines:
1. Return ONLY the raw inline <svg ...>...</svg> content within the JSON properties. No markdown code blocks, backticks, or escaping issues inside the SVG string.
2. The SVG MUST be valid XML. Close all tags.
3. Draw a modern, minimal, aesthetic line-art sketch. Use <path>, <circle>, <rect>, <ellipse> with stroke-width of 2 to 4px. Make it look like a hand-drawn chalkboard or recipe sketch.
4. Colors: Use stroke="#57534e" for main lines (or dark theme equivalent, but neutral dark line looks great), fill="none" or soft pastel fills matching our theme (e.g., fill="#f4f1eb" or #fef3c7), and highlight strokes/dots with stroke="#d97706" to represent spice, heat, garnish, or focal points.
5. Do not include text elements in the SVGs to avoid font rendering issues.

Ensure all ingredients have estimated numeric quantities where possible so they can be scaled.`;

     const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    console.log("Gemini API raw response:", responseText);
    
    // Parse response text to JSON and send it back
    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Gemini response was not valid JSON:", responseText);
      // Attempt to clean markdown backticks if Gemini added any despite JSON mode
      const jsonStart = responseText.indexOf('{');
      const jsonEnd = responseText.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        parsedData = JSON.parse(responseText.substring(jsonStart, jsonEnd + 1));
      } else {
        throw parseError;
      }
    }

    console.log("Parsed recipe data details:", {
      title: parsedData.title,
      prepTime: parsedData.prepTime,
      ingredientsCount: parsedData.ingredients?.length,
      instructionsCount: parsedData.instructions?.length,
      sketchesCount: parsedData.sketches ? Object.keys(parsedData.sketches).length : 0
    });

    return NextResponse.json({
      success: true,
      recipe: parsedData,
      metadata: extractedMeta
    });

  } catch (error) {
    console.error('API Error in /api/parse:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while parsing the recipe.' },
      { status: 500 }
    );
  }
}
