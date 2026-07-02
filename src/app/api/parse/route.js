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

// Helper to download video and convert to base64 for Gemini multimodal input
async function downloadVideoAsBase64(url) {
  try {
    console.log(`Downloading video bytes from: ${url.substring(0, 100)}...`);
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Limit to 30MB to allow complete video parsing by Gemini
    if (buffer.length > 30 * 1024 * 1024) {
      console.warn("Video size exceeds 30MB limit, skipping multimodal input.");
      return null;
    }
    
    return {
      data: buffer.toString('base64'),
      mimeType: 'video/mp4'
    };
  } catch (err) {
    console.error("Failed to download video data:", err);
    return null;
  }
}

// Simple crawler to extract basic metadata from a URL (with RapidAPI integration)
async function extractMetadata(url) {
  try {
    const isTikTok = url.includes('tiktok.com');
    const isInstagram = url.includes('instagram.com');

    // RapidAPI Scraper bypass if configured in .env.local (Instagram only)
    const rapidApiKey = process.env.RAPIDAPI_KEY?.trim();
    const rapidApiEndpoint = process.env.RAPIDAPI_ENDPOINT?.trim();

    if (isInstagram && rapidApiKey && rapidApiEndpoint) {
      try {
        console.log(`Using RapidAPI to scrape URL: ${url}`);
        const cleanEndpoint = rapidApiEndpoint.endsWith('=') || rapidApiEndpoint.includes('?') ? rapidApiEndpoint : `${rapidApiEndpoint}?url=`;
        const fetchUrl = cleanEndpoint.endsWith('=') || cleanEndpoint.endsWith('?') ? `${cleanEndpoint}${encodeURIComponent(url)}` : `${cleanEndpoint}?url=${encodeURIComponent(url)}`;
        const host = new URL(cleanEndpoint).hostname;

        console.log(`RapidAPI Request URL: ${fetchUrl}`);
        console.log(`RapidAPI Headers:`, {
          'x-rapidapi-key': rapidApiKey ? `${rapidApiKey.substring(0, 5)}...` : 'undefined',
          'x-rapidapi-host': host
        });

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
          // Prioritize standard/low-res streams (sd, main_media, regular video) over HD to minimize bandwidth, serverless compute, and token costs
          const videoUrl = data.video_sd || data.video_sd_url || data.data?.video_sd_url || data.data?.main_media || data.video_url || data.data?.video_url || data.data?.main_media_hd;
          if (caption) {
            console.log("RapidAPI successfully scraped caption! Length:", caption.length, "VideoUrl:", videoUrl ? "Present" : "Missing");
            return {
              title: data.title || '',
              description: caption,
              provider: 'Instagram',
              extractedText: caption,
              videoUrl: videoUrl || ''
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
      // 1. Fetch metadata from official public oEmbed API (always works, free, reliable)
      console.log("Fetching TikTok oEmbed metadata...");
      let oembedData = null;
      try {
        const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
        const response = await fetch(oembedUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        });
        if (response.ok) {
          oembedData = await response.json();
        }
      } catch (err) {
        console.error("Failed to fetch TikTok oEmbed metadata:", err);
      }

      // 2. Fetch direct video play URL using the subscribed Lundehund tiktok-api23 downloader
      const rapidApiKey = process.env.RAPIDAPI_KEY?.trim();
      let directPlayUrl = '';

      if (rapidApiKey) {
        try {
          console.log(`Querying Lundehund tiktok-api23 downloader for: ${url}`);
          const apiResponse = await fetch(`https://tiktok-api23.p.rapidapi.com/api/download/video?url=${encodeURIComponent(url)}`, {
            headers: {
              'x-rapidapi-key': rapidApiKey,
              'x-rapidapi-host': 'tiktok-api23.p.rapidapi.com'
            },
            next: { revalidate: 3600 }
          });
          
          if (apiResponse.ok) {
            const resData = await apiResponse.json();
            directPlayUrl = resData.play || resData.play_watermark || '';
            console.log("tiktok-api23 successfully resolved direct video play URL:", directPlayUrl ? "Yes" : "No");
          } else {
            console.warn(`tiktok-api23 downloader responded with status: ${apiResponse.status}`);
          }
        } catch (rapidErr) {
          console.error("Failed to query tiktok-api23 downloader:", rapidErr);
        }
      }

      if (oembedData) {
        return {
          title: oembedData.title || '',
          description: oembedData.title || '',
          author: oembedData.author_name || '',
          provider: 'TikTok',
          htmlContent: directPlayUrl ? '' : (oembedData.html || ''), // skip iframe if we have native mp4
          extractedText: `Title: ${oembedData.title || ''}. Author: ${oembedData.author_name || ''}`,
          videoUrl: directPlayUrl,
          rawMetadata: JSON.stringify(oembedData)
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

    const activeApiKey = process.env.GEMINI_API_KEY?.trim();

    if (!activeApiKey || activeApiKey === 'your_gemini_api_key_here') {
      return NextResponse.json(
        { error: 'Gemini API Key is missing on the server. Please configure GEMINI_API_KEY inside your .env.local file in the project root.' },
        { status: 400 }
      );
    }

    let sourceText = rawText || '';
    let extractedMeta = null;

    if (url && url.startsWith('http')) {
      const allowedDomains = ['instagram.com', 'instagr.am', 'tiktok.com', 'vm.tiktok.com'];
      const parsedUrl = new URL(url);
      const host = parsedUrl.hostname.toLowerCase();
      const isAllowed = allowedDomains.some(domain => host === domain || host.endsWith('.' + domain));

      if (!isAllowed) {
        return NextResponse.json(
          { error: 'Invalid link. Only Instagram and TikTok links are supported.' },
          { status: 400 }
        );
      }
    }

    const isInstagramUrl = url && url.includes('instagram.com');
    const isRapidApiConfigured = process.env.RAPIDAPI_KEY?.trim() && process.env.RAPIDAPI_ENDPOINT?.trim();

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
      model: 'gemini-3.1-flash-lite',
      generationConfig: {
        responseMimeType: 'application/json'
      }
    });


    const prompt = `You are an expert chef and certified nutritionist. Your task is to take this recipe caption, metadata, and description, and structure it into a complete recipe card with accurate nutritional analysis.

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
  "difficulty": "Easy | Medium | Hard",
  "category": "Dinner | Breakfast | Dessert | Appetizer | Snack | Drink | Other",
  "description": "A compelling 1-2 sentence description of the dish, highlighting its appeal.",
  "ingredients": [
    {
      "name": "Name of ingredient, e.g., Olive Oil",
      "quantity": 2.5,
      "unit": "tbsp"
    }
  ],
  "instructions": [
    "Step-by-step cooking instruction 1",
    "Step-by-step cooking instruction 2"
  ],
  "nutrition": {
    "calories": 450,
    "protein": "25g",
    "carbs": "40g",
    "fat": "15g",
    "fiber": "4g",
    "sodium": "620mg",
    "sugar": "8g",
    "healthScore": 7,
    "healthLabel": "Moderately Healthy",
    "healthSummary": "2-3 sentence plain-language assessment of the dish overall healthiness, mentioning what makes it good or bad for the diet.",
    "benefits": ["High in protein", "Rich in antioxidants"],
    "warnings": ["High in sodium", "Contains gluten", "High in saturated fat"],
    "dietTags": ["Gluten-free", "High-protein", "Low-carb"]
  }
}

Guidelines for the health analysis:
- healthScore: integer 1 (very unhealthy) to 10 (extremely healthy)
- healthLabel: one of: "Very Unhealthy" | "Unhealthy" | "Moderately Unhealthy" | "Neutral" | "Moderately Healthy" | "Healthy" | "Very Healthy"
- benefits: list genuine nutritional positives (max 4 items)
- warnings: list genuine concerns — high sodium, saturated fat, allergens, high sugar, ultra-processed ingredients (max 4 items, use empty array if none)
- dietTags: only use applicable tags from: Vegan, Vegetarian, Gluten-free, Dairy-free, Keto, Paleo, Low-carb, High-protein, Low-fat, Low-sodium, Nut-free

Ensure all ingredients have estimated numeric quantities where possible so they can be scaled.`;


    let contents = [];
    if (extractedMeta?.videoUrl) {
      const videoData = await downloadVideoAsBase64(extractedMeta.videoUrl);
      if (videoData) {
        console.log("Adding video bytes to Gemini request payload.");
        contents.push({
          inlineData: videoData
        });
        contents.push("Watch the cooking video provided inline, listen to the voiceover, read any text overlays, and combine this with the caption context to build the structured recipe card.");
      }
    }
    contents.push(prompt);

    const result = await model.generateContent(contents);
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
