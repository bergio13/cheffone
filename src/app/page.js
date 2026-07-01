'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './page.module.css';
import { useAuth } from '@/lib/authContext';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Appetizing loader tips to rotate while parsing
const LOADER_TIPS = [
  "Firing up the grill...",
  "Slicing pickles and shredding lettuce...",
  "Consulting the secret recipe book...",
  "Calculating calorie counts for your meal...",
  "Plating the digital burger card...",
  "Squeezing the ketchup and mustard...",
];

// ─── Auth Modal ────────────────────────────────────────────────────────────────
function AuthModal({ onClose }) {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmail = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        await signUpWithEmail(email, password, name);
      } else {
        await signInWithEmail(email, password);
      }
      onClose();
    } catch (e) {
      setError(e.message.replace('Firebase: ', '').replace(/\(auth\/.*\)/, '').trim());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <button className={styles.modalClose} onClick={onClose}>✕</button>

        <div className={styles.parseHeader}>
          <div className={styles.stickerBadge}>MEMBER CARD</div>
          <h2 className={styles.parseTitle}>
            {mode === 'signin' ? 'Welcome Back, Chef!' : 'Join the Kitchen'}
          </h2>
          <p className={styles.parseSubtitle}>
            {mode === 'signin'
              ? 'Sign in to sync your recipes across all devices.'
              : 'Create an account to save your recipes forever.'}
          </p>
        </div>

        {/* Google Sign-In */}
        <button
          className={styles.googleButton}
          onClick={handleGoogle}
          disabled={loading}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
            <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <div className={styles.authDivider}><span>or</span></div>

        <form onSubmit={handleEmail} className={styles.authForm}>
          {mode === 'signup' && (
            <input
              type="text"
              className={styles.authInput}
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}
          <input
            type="email"
            className={styles.authInput}
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            className={styles.authInput}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          {error && <div className={styles.errorAlert}>⚠️ {error}</div>}
          <button type="submit" className={styles.primaryButton} disabled={loading}>
            {loading ? <><span className={styles.spinnerMini}></span> Loading...</> : mode === 'signin' ? '🔐 Sign In' : '🍳 Create Account'}
          </button>
        </form>

        <p className={styles.authToggle}>
          {mode === 'signin' ? "New here? " : "Already have an account? "}
          <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}>
            {mode === 'signin' ? 'Create an account' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function Home() {
  const { user } = useAuth();
  const [url, setUrl] = useState('');
  const [rawText, setRawText] = useState('');
  const [showFallback, setShowFallback] = useState(false);
  const [recipes, setRecipes] = useState([]);
  const [activeRecipeId, setActiveRecipeId] = useState(null);

  const [activeTab, setActiveTab] = useState('recipe');
  const [adjustedServings, setAdjustedServings] = useState(2);
  const [checkedIngredients, setCheckedIngredients] = useState({});

  const [loading, setLoading] = useState(false);
  const [loaderTipIndex, setLoaderTipIndex] = useState(0);
  const [error, setError] = useState('');

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const hasMigratedRef = useRef(false);

  // ── Firestore helpers ──────────────────────────────────────────────────────
  const getUserRecipesRef = (uid) => collection(db, 'users', uid, 'recipes');

  const loadFromFirestore = async (uid) => {
    setIsSyncing(true);
    try {
      const q = query(getUserRecipesRef(uid), orderBy('parsedAt', 'desc'));
      const snap = await getDocs(q);
      const loaded = snap.docs.map((d) => d.data());
      setRecipes(loaded);
      if (loaded.length > 0) {
        setActiveRecipeId(loaded[0].id);
        setAdjustedServings(loaded[0].servings || 2);
      }
    } catch (e) {
      console.error('Firestore load error:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  const saveRecipeToFirestore = async (uid, recipe) => {
    await setDoc(doc(db, 'users', uid, 'recipes', recipe.id), recipe);
  };

  const deleteRecipeFromFirestore = async (uid, id) => {
    await deleteDoc(doc(db, 'users', uid, 'recipes', id));
  };

  // ── Migrate localStorage → Firestore on first login ───────────────────────
  const migrateLocalToFirestore = async (uid) => {
    if (hasMigratedRef.current) return;
    hasMigratedRef.current = true;
    const saved = localStorage.getItem('cheffone_recipes');
    if (!saved) return;
    try {
      const local = JSON.parse(saved);
      if (!local.length) return;
      const batch = writeBatch(db);
      local.forEach((r) => {
        batch.set(doc(db, 'users', uid, 'recipes', r.id), r);
      });
      await batch.commit();
      localStorage.removeItem('cheffone_recipes');
    } catch (e) {
      console.error('Migration error:', e);
    }
  };

  // ── Auth state effect ──────────────────────────────────────────────────────
  useEffect(() => {
    if (user === undefined) return; // still loading
    if (user) {
      migrateLocalToFirestore(user.uid).then(() => loadFromFirestore(user.uid));
    } else {
      // Not logged in — load from localStorage
      const saved = localStorage.getItem('cheffone_recipes');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setRecipes(parsed);
          if (parsed.length > 0) {
            setActiveRecipeId(parsed[0].id);
            setAdjustedServings(parsed[0].servings || 2);
          }
        } catch (e) {
          console.error('Failed to parse saved recipes:', e);
        }
      }
    }
  }, [user]);

  // ── Save recipes (localStorage or Firestore) ───────────────────────────────
  const saveRecipesToStorage = async (newRecipes, newRecipe = null) => {
    setRecipes(newRecipes);
    if (user) {
      if (newRecipe) await saveRecipeToFirestore(user.uid, newRecipe);
    } else {
      localStorage.setItem('cheffone_recipes', JSON.stringify(newRecipes));
    }
  };

  // ── Rotate loader tips ─────────────────────────────────────────────────────
  useEffect(() => {
    let interval;
    if (loading) {
      interval = setInterval(() => {
        setLoaderTipIndex((prev) => (prev + 1) % LOADER_TIPS.length);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [loading]);

  // ── Parse recipe ───────────────────────────────────────────────────────────
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, rawText }),
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
        videoUrl: data.metadata?.videoUrl || '',
        parsedAt: new Date().toISOString(),
      };

      const updatedRecipes = [newRecipe, ...recipes];
      await saveRecipesToStorage(updatedRecipes, newRecipe);
      setActiveRecipeId(newRecipe.id);
      setAdjustedServings(newRecipe.servings || 2);
      setCheckedIngredients({});
      setUrl('');
      setRawText('');
      setShowFallback(false);
      setActiveTab('recipe');
      setIsImportOpen(false);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Delete recipe ──────────────────────────────────────────────────────────
  const handleDeleteRecipe = async (id, e) => {
    e.stopPropagation();
    const filtered = recipes.filter((r) => r.id !== id);
    setRecipes(filtered);
    if (user) {
      await deleteRecipeFromFirestore(user.uid, id);
    } else {
      localStorage.setItem('cheffone_recipes', JSON.stringify(filtered));
    }
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

  const scaleQuantity = (quantity, originalServings) => {
    if (quantity === null || quantity === undefined) return '';
    const ratio = adjustedServings / (originalServings || 2);
    const scaled = quantity * ratio;
    return Math.round(scaled * 100) / 100;
  };

  const toggleIngredient = (index) => {
    setCheckedIngredients((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const triggerPrint = () => window.print();

  // ── User avatar chip ───────────────────────────────────────────────────────
  const { signOut } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const UserChip = () => {
    if (user === undefined) return null; // loading
    if (!user) {
      return (
        <button
          className={styles.syncButton}
          onClick={() => setIsAuthOpen(true)}
          title="Sign in to sync your recipes"
        >
          ☁️ Sync Recipes
        </button>
      );
    }
    const initials = (user.displayName || user.email || '?').charAt(0).toUpperCase();
    const photoURL = user.photoURL;
    return (
      <div className={styles.userChipWrapper}>
        <button
          className={styles.userChip}
          onClick={() => setShowUserMenu((v) => !v)}
          title={user.displayName || user.email}
        >
          {photoURL
            ? <img src={photoURL} alt="avatar" className={styles.userAvatar} referrerPolicy="no-referrer" />
            : <span className={styles.userInitials}>{initials}</span>
          }
          <span className={styles.userName}>{user.displayName || user.email?.split('@')[0]}</span>
          {isSyncing && <span className={styles.syncDot} title="Syncing..." />}
        </button>
        {showUserMenu && (
          <div className={styles.userMenu}>
            <div className={styles.userMenuEmail}>{user.email}</div>
            <button
              className={styles.userMenuSignOut}
              onClick={async () => { await signOut(); setShowUserMenu(false); setRecipes([]); setActiveRecipeId(null); }}
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      {/* Auth Modal */}
      {isAuthOpen && <AuthModal onClose={() => setIsAuthOpen(false)} />}

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.fastFoodIcon}>🍔</span>
          <div className={styles.logoText}>
            <h1>Cheffone</h1>
          </div>
        </div>
        <div className={styles.headerActions}>
          <UserChip />
          <button
            onClick={() => setIsImportOpen(true)}
            className={styles.primaryButton}
            style={{ padding: '0.8rem 1.6rem', fontSize: '1rem' }}
          >
            ⚡ Scan New Recipe
          </button>
        </div>
      </header>

      {/* Import Link Overlay Modal */}
      {isImportOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsImportOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button
              className={styles.modalClose}
              onClick={() => setIsImportOpen(false)}
              title="Close window"
            >
              ✕
            </button>

            <div className={styles.parseHeader}>
              <div className={styles.stickerBadge}>HOT &amp; FRESH</div>
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
                    if (val.includes('instagram.com')) setShowFallback(true);
                  }}
                  autoFocus
                />
              </div>
              <button type="submit" className={styles.primaryButton} disabled={loading}>
                {loading ? (
                  <><span className={styles.spinnerMini}></span>Grilling...</>
                ) : (
                  'Order Recipe ⚡'
                )}
              </button>
            </form>

            {/* Collapsible Transcript / Description Fallback */}
            <div className={styles.collapsibleArea}>
              <button
                type="button"
                className={styles.collapsibleTrigger}
                onClick={() => setShowFallback(!showFallback)}
              >
                <span className={styles.triggerIcon}>{showFallback ? '▼' : '▶'}</span>
                <span>Manual order: Paste caption text description</span>
              </button>

              {showFallback && (
                <div className={styles.collapsibleContent}>
                  <textarea
                    className={styles.textarea}
                    placeholder="Paste the caption, ingredients list, or notes here to parse..."
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
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className={styles.loaderOverlay}>
          <div className={styles.loaderContainer}>
            <div className={styles.loaderSpinner}>
              <div className={styles.loaderInnerRing}></div>
            </div>
            <p className={styles.loaderStatusText}>GRILLING YOUR RECIPE CARD...</p>
            <div className={styles.loaderTip}>{LOADER_TIPS[loaderTipIndex]}</div>
          </div>
        </div>
      )}

      {/* Main Board */}
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

                  <button onClick={triggerPrint} className={styles.printButton}>
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
                    🍔 Meal Board &amp; Video Player
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
                    {/* Left Side: Embedded Video */}
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
                    </div>

                    {/* Right Side: Ingredients & Directions */}
                    <div className={styles.rightContentColumn}>
                      {/* Ingredients */}
                      <div className={styles.ingredientsCard}>
                        <h4 className={styles.sectionHeading}>Ingredients Checklist</h4>
                        <p className={styles.sectionSubtitle}>Scale sizes above. Check items as you toss them in.</p>
                        <div className={styles.ingredientsList}>
                          {activeRecipe.ingredients?.map((ing, idx) => (
                            <label
                              key={idx}
                              className={`${styles.ingredientItem} ${checkedIngredients[idx] ? styles.ingredientChecked : ''}`}
                              onClick={() => toggleIngredient(idx)}
                            >
                              <div className={styles.checkboxWrapper}>
                                <input type="checkbox" className={styles.checkbox} checked={!!checkedIngredients[idx]} readOnly />
                                <span className={styles.customCheckbox}></span>
                              </div>
                              <span className={styles.ingredientText}>
                                <strong className={styles.quantityHighlight}>
                                  {scaleQuantity(ing.quantity, activeRecipe.servings)} {ing.unit}
                                </strong>{' '}
                                {ing.name}
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
              <p>Pick a recipe from your book on the left or click &quot;Scan New Recipe&quot; in the header to import a new recipe.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
