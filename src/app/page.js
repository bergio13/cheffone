'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

// Appetizing loader tips to rotate while parsing
const LOADER_TIPS = [
  "Firing up the grill...",
  "Slicing pickles and shredding lettuce...",
  "Consulting the secret recipe book...",
  "Calculating calorie counts for your meal...",
  "Plating the digital burger card...",
  "Squeezing the ketchup and mustard..."
];

export default function Home() {
  const [url, setUrl] = useState('');
  const [rawText, setRawText] = useState('');
  const [showFallback, setShowFallback] = useState(false);
  const [recipes, setRecipes] = useState([]);
  const [activeRecipeId, setActiveRecipeId] = useState(null);
  
  const [activeTab, setActiveTab] = useState('recipe'); // 'recipe', 'nutrition'
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

  // Save recipes to localStorage
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

      const parsedRecipe = data.recipe;
      if (!parsedRecipe) {
        throw new Error('API returned successfully but no recipe data was parsed.');
      }
      const newRecipe = {
        ...parsedRecipe,
        id: Date.now().toString(),
        sourceUrl: url,
        videoUrl: data.metadata?.videoUrl || '', // Extract and save direct video URL!
        parsedAt: new Date().toLocaleDateString(),
      };

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
    return Math.round(scaled * 100) / 100;
  };

  // Helper to check/uncheck ingredients
  const toggleIngredient = (index) => {
    setCheckedIngredients(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const triggerPrint = () => {
    window.print();
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.fastFoodIcon}>🍔</span>
          <div className={styles.logoText}>
            <h1>Cheffone</h1>
            <p>Hot & Fresh Video-to-Recipe Planner ⚡</p>
          </div>
        </div>
      </header>

      {/* Parser Box */}
      <section className={styles.parsePanel}>
        <div className={styles.parseHeader}>
          <div className={styles.stickerBadge}>HOT & FRESH</div>
          <h2 className={styles.parseTitle}>Scan a Video Recipe</h2>
          <p className={styles.parseSubtitle}>Paste a link below to parse the video details and print your recipe ticket!</p>
        </div>
        
        <form onSubmit={handleParseRecipe} className={styles.inputGroup}>
          <div className={styles.urlInputContainer}>
            <span className={styles.inputLinkIcon}>🍟</span>
            <input
              type="url"
              className={styles.urlInput}
              placeholder="Paste TikTok or Instagram video link..."
              value={url}
              onChange={(e) => {
                const val = e.target.value;
                setUrl(val);
                if (val.includes('instagram.com')) {
                  setShowFallback(true);
                }
              }}
            />
          </div>
          <button 
            type="submit" 
            className={styles.primaryButton}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className={styles.spinnerMini}></span>
                GRilling...
              </>
            ) : (
              "Order Recipe ⚡"
            )}
          </button>
        </form>

        {url.includes('instagram.com') && (
          <div className={styles.infoBanner}>
            <span className={styles.infoIcon}>💡</span>
            <span>Instagram links require a RapidAPI key. If not configured, copy the caption text and paste it below!</span>
          </div>
        )}

        {/* Collapsible Transcript / Description Fallback */}
        <div className={styles.collapsibleArea}>
          <button 
            type="button"
            className={styles.collapsibleTrigger}
            onClick={() => setShowFallback(!showFallback)}
          >
            <span className={styles.triggerIcon}>{showFallback ? "▼" : "▶"}</span>
            <span>Manual order: Paste caption text description</span>
          </button>

          {showFallback && (
            <div className={styles.collapsibleContent}>
              <textarea
                className={styles.textarea}
                placeholder="Paste the caption, ingredients list, or notes here..."
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
              />
              <span className={styles.textareaTip}>
                Tip: Copy the description text from the post to paste it.
              </span>
            </div>
          )}
        </div>

        {error && <div className={styles.errorAlert}>⚠️ {error}</div>}
      </section>

      {/* Loading Block */}
      {loading && (
        <div className={styles.loaderContainer}>
          <div className={styles.loaderSpinner}>
            <div className={styles.loaderInnerRing}></div>
          </div>
          <p className={styles.loaderStatusText}>GRILLING YOUR RECIPE CARD...</p>
          <div className={styles.loaderTip}>{LOADER_TIPS[loaderTipIndex]}</div>
        </div>
      )}

      {/* Main Board */}
      {!loading && (
        <main className={styles.mainLayout}>
          {/* Sidebar - Saved Recipes */}
          <aside className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
              <h3 className={styles.sidebarTitle}>Order Board</h3>
              <span className={styles.recipeCountBadge}>{recipes.length} ITEMS</span>
            </div>
            
            <div className={styles.recipeList}>
              {recipes.length === 0 ? (
                <div className={styles.emptyState}>
                  <span className={styles.emptyIcon}>🥤</span>
                  <p>Your order board is empty.</p>
                  <p className={styles.emptyTextSub}>Scan a video link to order your first recipe!</p>
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
                        <span>⏱️ {r.prepTime || 'N/A'}</span>
                        <span className={styles.metaDivider}>•</span>
                        <span>🏷️ {r.category}</span>
                      </div>
                    </div>
                    <button 
                      className={styles.deleteButton}
                      onClick={(e) => handleDeleteRecipe(r.id, e)}
                      title="Delete recipe"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </aside>

          {/* Active Recipe Panel */}
          <section className={styles.recipeDetailContainer}>
            {activeRecipe ? (
              <div className={styles.recipeDetail}>
                {/* Header details */}
                <div className={styles.recipeHeaderBlock}>
                  <div className={styles.titleArea}>
                    <div className={styles.titleBadgeContainer}>
                      <span className={styles.categoryBadge}>{activeRecipe.category || 'Recipe'}</span>
                      {activeRecipe.difficulty && (
                        <span className={`${styles.categoryBadge} ${styles.difficultyBadge}`}>
                          {activeRecipe.difficulty}
                        </span>
                      )}
                    </div>
                    <h2 className={styles.recipeTitle}>{activeRecipe.title}</h2>
                    {activeRecipe.description && <p className={styles.recipeDescription}>{activeRecipe.description}</p>}
                  </div>
                  
                  {/* Servings scale control */}
                  <div className={styles.headerControls}>
                    <div className={styles.servingAdjuster}>
                      <span className={styles.servingLabel}>SIZE:</span>
                      <button 
                        className={styles.adjustBtn} 
                        onClick={() => setAdjustedServings(Math.max(1, adjustedServings - 1))}
                      >
                        —
                      </button>
                      <span className={styles.servingCount}>{adjustedServings}</span>
                      <button 
                        className={styles.adjustBtn} 
                        onClick={() => setAdjustedServings(adjustedServings + 1)}
                      >
                        +
                      </button>
                    </div>
                    
                    <button 
                      onClick={triggerPrint} 
                      className={styles.printButton}
                    >
                      🖨️ Print Ticket
                    </button>
                  </div>
                </div>

                {/* Metadata Grid */}
                <div className={styles.metadataGrid}>
                  <div className={styles.metaItem}>
                    <span className={styles.metaIcon}>⏱️</span>
                    <div className={styles.metaText}>
                      <span className={styles.metaLabel}>Prep Time</span>
                      <span className={styles.metaValue}>{activeRecipe.prepTime || 'N/A'}</span>
                    </div>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaIcon}>🔥</span>
                    <div className={styles.metaText}>
                      <span className={styles.metaLabel}>Cook Time</span>
                      <span className={styles.metaValue}>{activeRecipe.cookTime || 'N/A'}</span>
                    </div>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaIcon}>🍔</span>
                    <div className={styles.metaText}>
                      <span className={styles.metaLabel}>Difficulty</span>
                      <span className={styles.metaValue}>{activeRecipe.difficulty || 'Easy'}</span>
                    </div>
                  </div>
                  {activeRecipe.sourceUrl && (
                    <div className={styles.metaItem}>
                      <span className={styles.metaIcon}>🎬</span>
                      <div className={styles.metaText}>
                        <span className={styles.metaLabel}>Source</span>
                        <a href={activeRecipe.sourceUrl} target="_blank" rel="noopener noreferrer" className={styles.metaLink}>
                          View Video
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tab System */}
                <div className={styles.tabsContainer}>
                  <div className={styles.tabs}>
                    <button 
                      className={`${styles.tab} ${activeTab === 'recipe' ? styles.activeTab : ''}`}
                      onClick={() => setActiveTab('recipe')}
                    >
                      🍔 Meal Board & Video Player
                    </button>
                    <button 
                      className={`${styles.tab} ${activeTab === 'nutrition' ? styles.activeTab : ''}`}
                      onClick={() => setActiveTab('nutrition')}
                    >
                      🍟 Nutrition Facts Ticket
                    </button>
                  </div>
                </div>

                {/* Tab content */}
                <div className={styles.tabContent}>
                  {/* Ingredients & Steps */}
                  {activeTab === 'recipe' && (
                    <div className={styles.culinaryGrid}>
                      
                      {/* Left Side: Embedded Video + Quick Macros */}
                      <div className={styles.leftMediaColumn}>
                        {activeRecipe.videoUrl ? (
                          <div className={styles.videoCard}>
                            <div className={styles.videoCardTab}>NOW PLAYING 🎬</div>
                            <div className={styles.videoPlayerWrapper}>
                              <video 
                                src={activeRecipe.videoUrl} 
                                controls 
                                playsInline
                                className={styles.videoElement}
                                preload="metadata"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className={styles.videoCardPlaceholder}>
                            <span className={styles.placeholderIcon}>🎬</span>
                            <p className={styles.placeholderTitle}>No Video Feed</p>
                            <span className={styles.placeholderSub}>
                              Add your RAPIDAPI_KEY to download and watch the recipe video right inside the app!
                            </span>
                          </div>
                        )}
                        
                        {/* Quick Macros Card */}
                        <div className={styles.quickMacrosCard}>
                          <h4 className={styles.sectionHeading}>Quick Stats</h4>
                          <div className={styles.quickMacrosGrid}>
                            <div className={styles.macroStat}>
                              <span className={styles.macroVal}>{activeRecipe.nutrition?.calories || '—'}</span>
                              <span className={styles.macroName}>Cals</span>
                            </div>
                            <div className={styles.macroStat}>
                              <span className={styles.macroVal}>{activeRecipe.nutrition?.protein || '—'}</span>
                              <span className={styles.macroName}>Prot</span>
                            </div>
                            <div className={styles.macroStat}>
                              <span className={styles.macroVal}>{activeRecipe.nutrition?.carbs || '—'}</span>
                              <span className={styles.macroName}>Carbs</span>
                            </div>
                            <div className={styles.macroStat}>
                              <span className={styles.macroVal}>{activeRecipe.nutrition?.fat || '—'}</span>
                              <span className={styles.macroName}>Fat</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Side: Ingredients & Directions */}
                      <div className={styles.rightContentColumn}>
                        {/* Ingredients */}
                        <div className={styles.ingredientsCard}>
                          <h4 className={styles.sectionHeading}>Ingredients Checklist</h4>
                          <p className={styles.sectionSubtitle}>Scale sizes above. Check items as you toss them in.</p>
                          <div className={styles.ingredientsList}>
                            {activeRecipe.ingredients?.map((ing, idx) => (
                              <label key={idx} className={`${styles.ingredientItem} ${checkedIngredients[idx] ? styles.ingredientChecked : ''}`} onClick={() => toggleIngredient(idx)}>
                                <div className={styles.checkboxWrapper}>
                                  <input 
                                    type="checkbox" 
                                    className={styles.checkbox}
                                    checked={!!checkedIngredients[idx]}
                                    readOnly
                                  />
                                  <span className={styles.customCheckbox}></span>
                                </div>
                                <span className={styles.ingredientText}>
                                  <strong className={styles.quantityHighlight}>
                                    {scaleQuantity(ing.quantity, activeRecipe.servings)} {ing.unit}
                                  </strong> {ing.name}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* Directions */}
                        <div className={styles.instructionsCard}>
                          <h4 className={styles.sectionHeading}>Cooking Directions</h4>
                          <div className={styles.instructionsList}>
                            {activeRecipe.instructions?.map((step, idx) => (
                              <div key={idx} className={styles.stepCard}>
                                <div className={styles.stepIndicator}>
                                  <div className={styles.stepNumber}>{idx + 1}</div>
                                  {idx < activeRecipe.instructions.length - 1 && <div className={styles.stepConnector}></div>}
                                </div>
                                <div className={styles.stepContent}>
                                  <p>{step}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Nutrition */}
                  {activeTab === 'nutrition' && (
                    <div className={styles.nutritionContainer}>
                      <div className={styles.nutritionHeader}>
                        <h4 className={styles.sectionHeading}>Nutrition Facts</h4>
                        <p className={styles.sectionSubtitle}>Estimated values per single serving size.</p>
                      </div>
                      
                      <div className={styles.nutritionGrid}>
                        <div className={`${styles.nutritionCard} ${styles.calCard}`}>
                          <span className={styles.nutritionVal}>{activeRecipe.nutrition?.calories || '—'}</span>
                          <span className={styles.nutritionLabel}>Calories</span>
                          <div className={styles.macroIndicator} style={{ background: 'var(--accent-primary)' }}></div>
                        </div>
                        <div className={`${styles.nutritionCard} ${styles.protCard}`}>
                          <span className={styles.nutritionVal}>{activeRecipe.nutrition?.protein || '—'}</span>
                          <span className={styles.nutritionLabel}>Protein</span>
                          <div className={styles.macroIndicator} style={{ background: 'var(--success)' }}></div>
                        </div>
                        <div className={`${styles.nutritionCard} ${styles.carbCard}`}>
                          <span className={styles.nutritionVal}>{activeRecipe.nutrition?.carbs || '—'}</span>
                          <span className={styles.nutritionLabel}>Carbs</span>
                          <div className={styles.macroIndicator} style={{ background: 'var(--accent-yellow)' }}></div>
                        </div>
                        <div className={`${styles.nutritionCard} ${styles.fatCard}`}>
                          <span className={styles.nutritionVal}>{activeRecipe.nutrition?.fat || '—'}</span>
                          <span className={styles.nutritionLabel}>Fat</span>
                          <div className={styles.macroIndicator} style={{ background: 'var(--text-primary)' }}></div>
                        </div>
                        {activeRecipe.nutrition?.fiber && (
                          <div className={`${styles.nutritionCard} ${styles.fibCard}`}>
                            <span className={styles.nutritionVal}>{activeRecipe.nutrition.fiber}</span>
                            <span className={styles.nutritionLabel}>Fiber</span>
                            <div className={styles.macroIndicator} style={{ background: '#7c3aed' }}></div>
                          </div>
                        )}
                      </div>

                      <div className={styles.nutritionDisclaimer}>
                        <span className={styles.disclaimerIcon}>⚠️</span>
                        <span>Macros are automatically estimated by Gemini AI based on recipe constituents. For precise medical guidelines, consult a professional.</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className={styles.emptyDetailState}>
                <span className={styles.emptyStateIcon}>🥤</span>
                <h3>No Meal Selected</h3>
                <p>Pick a recipe from your book on the left or scan a new video link above to view your cooking planner card.</p>
              </div>
            )}
          </section>
        </main>
      )}
    </div>
  );
}
