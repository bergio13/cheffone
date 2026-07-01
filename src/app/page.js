'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

// Loader tips to rotate while parsing
const LOADER_TIPS = [
  "Translating video speech into ingredients...",
  "Estimating nutritional values from the recipe...",
  "Drawing hand-drawn SVGs of the ingredients...",
  "Creating standard steps and instructions...",
  "Polishing the final culinary presentation sketches...",
  "Consulting the virtual chef for serving ratios..."
];

export default function Home() {
  const [url, setUrl] = useState('');
  const [rawText, setRawText] = useState('');
  const [showFallback, setShowFallback] = useState(false);
  const [recipes, setRecipes] = useState([]);
  const [activeRecipeId, setActiveRecipeId] = useState(null);
  
  const [activeTab, setActiveTab] = useState('recipe'); // 'recipe', 'nutrition', 'sketches'
  const [adjustedServings, setAdjustedServings] = useState(2);
  const [checkedIngredients, setCheckedIngredients] = useState({});

  const [loading, setLoading] = useState(false);
  const [loaderTipIndex, setLoaderTipIndex] = useState(0);
  const [error, setError] = useState('');

  // Load Saved Recipes on mount
  useEffect(() => {

    const savedRecipes = localStorage.getItem('cheffone_recipes');
    if (savedRecipes) {
      try {
        const parsed = JSON.parse(savedRecipes);
        setRecipes(parsed);
        if (parsed.length > 0) {
          setActiveRecipeId(parsed[0].id);
          setAdjustedServings(parsed[0].servings || 2);
        }
      } catch (e) {
        console.error('Failed to parse saved recipes:', e);
      }
    }
  }, []);

  // Save recipes to localStorage when state changes
  const saveRecipesToStorage = (newRecipes) => {
    setRecipes(newRecipes);
    localStorage.setItem('cheffone_recipes', JSON.stringify(newRecipes));
  };


  // Rotate loader tips
  useEffect(() => {
    let interval;
    if (loading) {
      interval = setInterval(() => {
        setLoaderTipIndex((prev) => (prev + 1) % LOADER_TIPS.length);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [loading]);

  // Handle Recipe Parsing API Call
  const handleParseRecipe = async (e) => {
    e.preventDefault();
    if (!url.trim() && !rawText.trim()) {
      setError('Please enter a TikTok/Instagram URL or paste recipe details.');
      return;
    }

    setLoading(true);
    setError('');
    setLoaderTipIndex(0);

    try {
      const response = await fetch('/api/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          rawText,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to parse recipe. Please check your URL or API key.');
      }

      console.log('Client received data:', data);
      const parsedRecipe = data.recipe;
      if (!parsedRecipe) {
        throw new Error('API returned successfully but no recipe data was parsed.');
      }
      const newRecipe = {
        ...parsedRecipe,
        id: Date.now().toString(),
        sourceUrl: url,
        parsedAt: new Date().toLocaleDateString(),
      };

      console.log('Adding new recipe to state:', newRecipe);
      const updatedRecipes = [newRecipe, ...recipes];
      saveRecipesToStorage(updatedRecipes);
      setActiveRecipeId(newRecipe.id);
      setAdjustedServings(newRecipe.servings || 2);
      setCheckedIngredients({});
      setUrl('');
      setRawText('');
      setShowFallback(false);
      setActiveTab('recipe');

    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete a recipe
  const handleDeleteRecipe = (id, e) => {
    e.stopPropagation();
    const filtered = recipes.filter((r) => r.id !== id);
    saveRecipesToStorage(filtered);
    if (activeRecipeId === id) {
      if (filtered.length > 0) {
        setActiveRecipeId(filtered[0].id);
        setAdjustedServings(filtered[0].servings || 2);
      } else {
        setActiveRecipeId(null);
      }
      setCheckedIngredients({});
    }
  };

  const activeRecipe = recipes.find((r) => r.id === activeRecipeId);

  // Helper to format/scale ingredient quantities
  const scaleQuantity = (quantity, originalServings) => {
    if (quantity === null || quantity === undefined) return '';
    const ratio = adjustedServings / (originalServings || 2);
    const scaled = quantity * ratio;
    // Clean rounding up to 2 decimal places
    return Math.round(scaled * 100) / 100;
  };

  // Helper to check/uncheck ingredients
  const toggleIngredient = (index) => {
    setCheckedIngredients(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Helper to clean SVGs from Gemini markdown wrapping if any
  const cleanSvg = (svgString) => {
    if (!svgString) return '';
    let cleaned = svgString.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```[a-z]*\n/i, '').replace(/\n```$/, '');
    }
    return cleaned;
  };

  const triggerPrint = () => {
    window.print();
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>🍳</span>
          <div className={styles.logoText}>
            <h1>Cheffone</h1>
            <p>Video-to-Recipe AI Assistant</p>
          </div>
        </div>
      </header>

      {/* Parser Box */}
      <section className={styles.parsePanel}>
        <h2 className={styles.parseTitle}>Paste Video Link</h2>
        
        <form onSubmit={handleParseRecipe} className={styles.inputGroup}>
          <input
            type="url"
            className={styles.urlInput}
            placeholder="Paste TikTok or Instagram recipe URL here..."
            value={url}
            onChange={(e) => {
              const val = e.target.value;
              setUrl(val);
              if (val.includes('instagram.com')) {
                setShowFallback(true);
              }
            }}
          />
          <button 
            type="submit" 
            className={styles.primaryButton}
            disabled={loading}
          >
            {loading ? "Generating..." : "Get Recipe ✨"}
          </button>
        </form>

        {url.includes('instagram.com') && (
          <div style={{ color: 'var(--accent-primary)', fontSize: '0.85rem', fontWeight: '600', animation: 'fadeIn 0.2s' }}>
            💡 Instagram links cannot be read automatically due to platform security. Please copy the caption/ingredients from the post and paste it below!
          </div>
        )}

        {/* Collapsible Transcript / Description Fallback */}
        <button 
          type="button"
          className={styles.collapsibleTrigger}
          onClick={() => setShowFallback(!showFallback)}
        >
          {showFallback ? "▼ Hide transcript options" : "▶ Can't scrape? Paste caption/transcript manually"}
        </button>

        {showFallback && (
          <div className={styles.collapsibleContent}>
            <textarea
              className={styles.textarea}
              placeholder="Paste the video caption description, comments, transcript, or raw text ingredients list here to parse..."
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
              Tip: Copy the caption directly from the TikTok or Instagram post and paste it here.
            </span>
          </div>
        )}

        {error && <div style={{ color: 'var(--error)', fontSize: '0.9rem', marginTop: '0.5rem', fontWeight: '500' }}>⚠️ {error}</div>}
      </section>

      {/* Loading Block */}
      {loading && (
        <div className={styles.loaderContainer}>
          <div className={styles.loaderSpinner}></div>
          <p style={{ fontWeight: '600' }}>Crafting your recipe card...</p>
          <div className={styles.loaderTip}>{LOADER_TIPS[loaderTipIndex]}</div>
        </div>
      )}

      {/* Main Board */}
      {!loading && (
        <main className={styles.mainLayout}>
          {/* Sidebar - Saved Recipes */}
          <aside className={styles.sidebar}>
            <h3 className={styles.sidebarTitle}>Saved Recipes</h3>
            <div className={styles.recipeList}>
              {recipes.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>No recipes saved yet.</p>
                  <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Paste a link or write a transcript to parse your first recipe card!</p>
                </div>
              ) : (
                recipes.map((r) => (
                  <div 
                    key={r.id} 
                    className={`${styles.recipeCardItem} ${activeRecipeId === r.id ? styles.recipeCardActive : ''}`}
                    onClick={() => {
                      setActiveRecipeId(r.id);
                      setAdjustedServings(r.servings || 2);
                      setCheckedIngredients({});
                    }}
                  >
                    <div className={styles.recipeCardInfo}>
                      <span className={styles.recipeCardTitle}>{r.title}</span>
                      <div className={styles.recipeCardMeta}>
                        <span>⏱️ {r.prepTime}</span>
                        <span>🏷️ {r.category}</span>
                      </div>
                    </div>
                    <button 
                      className={styles.deleteButton}
                      onClick={(e) => handleDeleteRecipe(r.id, e)}
                      title="Delete recipe"
                    >
                      🗑️
                    </button>
                  </div>
                ))
              )}
            </div>
          </aside>

          {/* Active Recipe Panel */}
          <section style={{ flex: 1 }}>
            {activeRecipe ? (
              <div className={styles.recipeDetail}>
                {/* Header details */}
                <div className={styles.recipeHeaderBlock}>
                  <div className={styles.titleArea}>
                    <span className={styles.categoryBadge}>{activeRecipe.category || 'Recipe'}</span>
                    <h2 className={styles.recipeTitle}>{activeRecipe.title}</h2>
                    {activeRecipe.description && <p className={styles.recipeDescription}>{activeRecipe.description}</p>}
                  </div>
                  
                  {/* Servings scale control */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                    <div className={styles.servingAdjuster}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Servings:</span>
                      <button 
                        className={styles.adjustBtn} 
                        onClick={() => setAdjustedServings(Math.max(1, adjustedServings - 1))}
                      >
                        -
                      </button>
                      <span style={{ fontWeight: 'bold', width: '20px', textAlign: 'center' }}>{adjustedServings}</span>
                      <button 
                        className={styles.adjustBtn} 
                        onClick={() => setAdjustedServings(adjustedServings + 1)}
                      >
                        +
                      </button>
                    </div>
                    
                    <button 
                      onClick={triggerPrint} 
                      className={styles.keyAlertButton}
                      style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--card-border)' }}
                    >
                      🖨️ Print Card
                    </button>
                  </div>
                </div>

                {/* Metadata Grid */}
                <div className={styles.metadataGrid}>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Prep Time:</span>
                    <span className={styles.metaValue}>{activeRecipe.prepTime || 'N/A'}</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Cook Time:</span>
                    <span className={styles.metaValue}>{activeRecipe.cookTime || 'N/A'}</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Difficulty:</span>
                    <span className={styles.metaValue}>{activeRecipe.difficulty || 'Easy'}</span>
                  </div>
                  {activeRecipe.sourceUrl && (
                    <div className={styles.metaItem}>
                      <a href={activeRecipe.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', fontWeight: '600', textDecoration: 'underline' }}>
                        🔗 Original Video Source
                      </a>
                    </div>
                  )}
                </div>

                {/* Tabs */}
                <div className={styles.tabs}>
                  <button 
                    className={`${styles.tab} ${activeTab === 'recipe' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('recipe')}
                  >
                    Ingredients & Steps
                  </button>
                  <button 
                    className={`${styles.tab} ${activeTab === 'nutrition' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('nutrition')}
                  >
                    Nutritional Facts
                  </button>
                  <button 
                    className={`${styles.tab} ${activeTab === 'sketches' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('sketches')}
                  >
                    Cooking Sketches (3D Stage Art)
                  </button>
                </div>

                {/* Tab content */}
                <div className={styles.tabContent}>
                  {/* Ingredients & Steps */}
                  {activeTab === 'recipe' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2rem', flexWrap: 'wrap' }}>
                      {/* Left: Ingredients */}
                      <div>
                        <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', marginBottom: '1rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.25rem' }}>Ingredients</h4>
                        <div className={styles.ingredientsList}>
                          {activeRecipe.ingredients?.map((ing, idx) => (
                            <label key={idx} className={styles.ingredientItem} onClick={() => toggleIngredient(idx)}>
                              <input 
                                type="checkbox" 
                                className={styles.checkbox}
                                checked={!!checkedIngredients[idx]}
                                readOnly
                              />
                              <span className={`${styles.ingredientText} ${checkedIngredients[idx] ? styles.checkedText : ''}`}>
                                <strong>{scaleQuantity(ing.quantity, activeRecipe.servings)} {ing.unit}</strong> {ing.name}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Right: Instructions */}
                      <div>
                        <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', marginBottom: '1rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.25rem' }}>Instructions</h4>
                        <div className={styles.instructionsList}>
                          {activeRecipe.instructions?.map((step, idx) => (
                            <div key={idx} className={styles.stepCard}>
                              <div className={styles.stepNumber}>{idx + 1}</div>
                              <div className={styles.stepContent}>{step}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Nutrition */}
                  {activeTab === 'nutrition' && (
                    <div>
                      <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', marginBottom: '1rem' }}>Nutrition Estimations (per serving)</h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginBottom: '1.5rem', fontStyle: 'italic' }}>
                        *Calculated using Gemini AI based on the ingredients list. Subject to variation.
                      </p>
                      <div className={styles.nutritionGrid}>
                        <div className={styles.nutritionCard}>
                          <span className={styles.nutritionVal}>{activeRecipe.nutrition?.calories || '—'}</span>
                          <span className={styles.nutritionLabel}>Calories</span>
                        </div>
                        <div className={styles.nutritionCard}>
                          <span className={styles.nutritionVal}>{activeRecipe.nutrition?.protein || '—'}</span>
                          <span className={styles.nutritionLabel}>Protein</span>
                        </div>
                        <div className={styles.nutritionCard}>
                          <span className={styles.nutritionVal}>{activeRecipe.nutrition?.carbs || '—'}</span>
                          <span className={styles.nutritionLabel}>Carbohydrates</span>
                        </div>
                        <div className={styles.nutritionCard}>
                          <span className={styles.nutritionVal}>{activeRecipe.nutrition?.fat || '—'}</span>
                          <span className={styles.nutritionLabel}>Fat</span>
                        </div>
                        {activeRecipe.nutrition?.fiber && (
                          <div className={styles.nutritionCard}>
                            <span className={styles.nutritionVal}>{activeRecipe.nutrition.fiber}</span>
                            <span className={styles.nutritionLabel}>Fiber</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Sketches */}
                  {activeTab === 'sketches' && (
                    <div className={styles.sketchesContainer}>
                      <p className={styles.sketchesInstruction}>
                        Sketches dynamically generated by Gemini AI representing different stages of cooking.
                      </p>
                      <div className={styles.sketchesGrid}>
                        {/* Ingredients Sketch */}
                        <div className={styles.sketchCard}>
                          <span className={styles.sketchTitle}>Stage 1: Prep & Ingredients</span>
                          {activeRecipe.sketches?.ingredients ? (
                            <div 
                              className={styles.sketchSvgWrapper} 
                              dangerouslySetInnerHTML={{ __html: cleanSvg(activeRecipe.sketches.ingredients) }}
                            />
                          ) : (
                            <div className={styles.sketchSvgWrapper}>🎨 No sketch available</div>
                          )}
                        </div>

                        {/* Process Sketch */}
                        <div className={styles.sketchCard}>
                          <span className={styles.sketchTitle}>Stage 2: Cooking Action</span>
                          {activeRecipe.sketches?.process ? (
                            <div 
                              className={styles.sketchSvgWrapper} 
                              dangerouslySetInnerHTML={{ __html: cleanSvg(activeRecipe.sketches.process) }}
                            />
                          ) : (
                            <div className={styles.sketchSvgWrapper}>🎨 No sketch available</div>
                          )}
                        </div>

                        {/* Finished Sketch */}
                        <div className={styles.sketchCard}>
                          <span className={styles.sketchTitle}>Stage 3: Finished Dish</span>
                          {activeRecipe.sketches?.finished ? (
                            <div 
                              className={styles.sketchSvgWrapper} 
                              dangerouslySetInnerHTML={{ __html: cleanSvg(activeRecipe.sketches.finished) }}
                            />
                          ) : (
                            <div className={styles.sketchSvgWrapper}>🎨 No sketch available</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className={styles.recipeDetail} style={{ alignItems: 'center', justifyContent: 'center', minHeight: '350px' }}>
                <span style={{ fontSize: '3rem' }}>🍲</span>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', marginTop: '1rem' }}>No Active Recipe</h3>
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>Paste a video link above to generate and display a recipe.</p>
              </div>
            )}
          </section>
        </main>
      )}


    </div>
  );
}
