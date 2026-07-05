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
import FriendsModal from '@/components/FriendsModal';
import InboxModal from '@/components/InboxModal';
import { getFriends, getPendingRequests, getInbox, shareRecipeWithFriend, getParseLimitStatus, incrementParseCount } from '@/lib/friends';

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

  // Support forcing theme via URL query parameter (e.g. ?theme=dark)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const themeParam = params.get('theme');
    if (themeParam === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else if (themeParam === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, []);
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

  // Social state
  const [isFriendsOpen, setIsFriendsOpen] = useState(false);
  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState(null); // recipe being shared
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [inboxItems, setInboxItems] = useState([]);
  const [toast, setToast] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'detail'
  const [playVideoId, setPlayVideoId] = useState(null);

  const hasMigratedRef = useRef(false);

  // Reset video preview when active recipe changes
  useEffect(() => {
    Promise.resolve().then(() => setPlayVideoId(null));
  }, [activeRecipeId]);

  const activeRecipe = recipes.find((r) => r.id === activeRecipeId);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

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
      // Load social data
      getFriends(user.uid).then(setFriends);
      getPendingRequests(user.uid).then(setPendingRequests);
      getInbox(user.uid).then(setInboxItems);
    } else {
      // Not logged in — load from localStorage
      const saved = localStorage.getItem('cheffone_recipes');
      Promise.resolve().then(() => {
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
        setFriends([]);
        setPendingRequests([]);
        setInboxItems([]);
      });
    }
  }, [user]);

  // ── TikTok Embed script dynamic re-evaluation ──────────────────────────────
  useEffect(() => {
    if (activeRecipe?.iframeHtml) {
      // Remove any existing script tag to force a re-evaluation reload
      const oldScript = document.getElementById('tiktok-embed-script');
      if (oldScript) {
        oldScript.remove();
      }

      // Re-trigger global widget rendering if loaded, otherwise add script
      if (window.tiktok && typeof window.tiktok.embed === 'object' && typeof window.tiktok.embed.render === 'function') {
        window.tiktok.embed.render();
      } else {
        const script = document.createElement('script');
        script.id = 'tiktok-embed-script';
        script.src = 'https://www.tiktok.com/embed.js';
        script.async = true;
        document.body.appendChild(script);
      }
    }
  }, [activeRecipeId, activeRecipe?.iframeHtml]);

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

    if (!user) {
      setError('You must be signed in to scan recipes!');
      setIsAuthOpen(true);
      return;
    }

    if (url.trim()) {
      try {
        const allowedDomains = ['instagram.com', 'instagr.am', 'tiktok.com', 'vm.tiktok.com'];
        const parsedUrl = new URL(url.trim());
        const host = parsedUrl.hostname.toLowerCase();
        const isAllowed = allowedDomains.some(domain => host === domain || host.endsWith('.' + domain));

        if (!isAllowed) {
          setError('Only TikTok and Instagram links are supported.');
          return;
        }
      } catch (err) {
        setError('Please enter a valid URL.');
        return;
      }
    }

    // ── Check Daily Parse Limit (5 recipes per day) ──────────────────────────
    const today = new Date().toISOString().split('T')[0];
    try {
      const limitStatus = await getParseLimitStatus(user.uid, 5);
      if (!limitStatus.allowed) {
        setError('Daily limit reached! You can parse up to 5 recipes per day.');
        return;
      }
    } catch (err) {
      console.error("Failed to check parse limit:", err);
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
        iframeHtml: data.metadata?.htmlContent || '',
        parsedAt: new Date().toISOString(),
      };

      const updatedRecipes = [newRecipe, ...recipes];
      await saveRecipesToStorage(updatedRecipes, newRecipe);
      setActiveRecipeId(newRecipe.id);
      setViewMode('detail');
      setAdjustedServings(newRecipe.servings || 2);
      setCheckedIngredients({});
      setUrl('');
      setRawText('');
      setShowFallback(false);
      setActiveTab('recipe');
      setIsImportOpen(false);

      // ── Increment Daily Parse Limit Counter ────────────────────────────────
      try {
        await incrementParseCount(user.uid);
      } catch (err) {
        console.error("Failed to increment parse count:", err);
      }
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
      setViewMode('list');
      if (filtered.length > 0) {
        setActiveRecipeId(filtered[0].id);
        setAdjustedServings(filtered[0].servings || 2);
      } else {
        setActiveRecipeId(null);
      }
      setCheckedIngredients({});
    }
  };



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

  // ── Social handlers ────────────────────────────────────────────────────────
  const handleShareRecipe = (recipe) => {
    if (!user) { setIsAuthOpen(true); return; }
    setShareTarget(recipe);
    setIsFriendsOpen(true);
  };

  const handleSaveInboxRecipe = async (recipe) => {
    const newRecipe = { ...recipe, id: Date.now().toString(), savedFromFriend: true };
    const updatedRecipes = [newRecipe, ...recipes];
    await saveRecipesToStorage(updatedRecipes, newRecipe);
    setActiveRecipeId(newRecipe.id);
    setAdjustedServings(newRecipe.servings || 2);
    setIsInboxOpen(false);
    showToast('Recipe saved to your collection! 🍳');
  };

  const unreadInbox = inboxItems.filter((i) => !i.seen).length;
  const pendingCount = pendingRequests.length;

  // ── User avatar chip ───────────────────────────────────────────────────────
  const { signOut } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const renderUserChip = () => {
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

      {/* Friends Modal */}
      {isFriendsOpen && (
        <FriendsModal
          currentUser={user}
          onClose={() => { setIsFriendsOpen(false); setShareTarget(null); }}
          recipeToShare={shareTarget}
          onShared={(friendName) => {
            showToast(`Recipe shared with ${friendName}! 📤`);
          }}
        />
      )}

      {/* Inbox Modal */}
      {isInboxOpen && (
        <InboxModal
          currentUser={user}
          onClose={() => setIsInboxOpen(false)}
          onSaveRecipe={handleSaveInboxRecipe}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={styles.toast}>{toast}</div>
      )}

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.fastFoodIcon}>🍔</span>
          <div className={styles.logoText}>
            <h1>Cheffone</h1>
          </div>
        </div>
        <div className={styles.headerActions}>
          {user && (
            <>
              <button
                className={styles.socialBtn}
                onClick={() => { setShareTarget(null); setIsFriendsOpen(true); }}
                title="Friends"
              >
                👥
                {pendingCount > 0 && <span className={styles.socialBadge}>{pendingCount}</span>}
              </button>
              <button
                className={styles.socialBtn}
                onClick={() => setIsInboxOpen(true)}
                title="Recipe Inbox"
              >
                📬
                {unreadInbox > 0 && <span className={styles.socialBadge}>{unreadInbox}</span>}
              </button>
            </>
          )}
          {renderUserChip()}
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
              <p className={styles.parseSubtitle}>Paste a link below to parse the video details!</p>
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
      <main className={`${styles.mainLayout} ${!sidebarOpen ? styles.mainLayoutCollapsed : ''} ${viewMode === 'detail' ? styles.mobileShowDetail : styles.mobileShowList}`}>
        {/* Sidebar - Saved Recipes */}
        <aside className={`${styles.sidebar} ${!sidebarOpen ? styles.sidebarCollapsed : ''}`}>
          <div className={styles.sidebarHeader}>
            {sidebarOpen && <h3 className={styles.sidebarTitle}>Order Board</h3>}
            {sidebarOpen && <span className={styles.recipeCountBadge}>{recipes.length} ITEMS</span>}
            <button
              className={styles.sidebarToggle}
              onClick={() => setSidebarOpen(v => !v)}
              title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {sidebarOpen ? '‹' : '›'}
            </button>
          </div>

          {sidebarOpen && (
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
                      setViewMode('detail');
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
                    <div className={styles.recipeCardActions}>
                      {user && (
                        <button
                          className={styles.shareButton}
                          onClick={(e) => { e.stopPropagation(); handleShareRecipe(r); }}
                          title="Share with a friend"
                        >
                          📤 Share
                        </button>
                      )}
                      <button
                        className={styles.deleteButton}
                        onClick={(e) => handleDeleteRecipe(r.id, e)}
                        title="Delete recipe"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          {!sidebarOpen && recipes.length > 0 && (
            <div className={styles.collapsedDots}>
              {recipes.slice(0, 6).map((r) => (
                <div
                  key={r.id}
                  className={`${styles.collapsedDot} ${activeRecipeId === r.id ? styles.collapsedDotActive : ''}`}
                  onClick={() => { setActiveRecipeId(r.id); setViewMode('detail'); setAdjustedServings(r.servings || 2); setSidebarOpen(true); }}
                  title={r.title}
                />
              ))}
              {recipes.length > 6 && (
                <div className={styles.collapsedMore} onClick={() => setSidebarOpen(true)} title="Show all recipes">
                  +{recipes.length - 6}
                </div>
              )}
            </div>
          )}
        </aside>

        {/* Active Recipe Panel */}
        <section className={styles.recipeDetailContainer}>
          {activeRecipe ? (
            <div className={styles.recipeDetail}>
              {/* Header details */}
              <div className={styles.recipeHeaderBlock}>
                <button
                  className={styles.mobileBackBtn}
                  onClick={() => setViewMode('list')}
                  title="Back to board"
                >
                  ← Back to Board
                </button>
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
                    className={styles.detailShareBtn}
                    onClick={() => handleShareRecipe(activeRecipe)}
                    title="Share recipe with friends"
                  >
                    📤 Share with Friends
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
                      {activeRecipe.iframeHtml ? (
                        playVideoId === activeRecipe.id ? (
                          <div className={styles.videoCard}>
                            <div className={styles.videoCardTab}>TIKTOK PREVIEW 🎬</div>
                            <div
                              className={styles.iframeContainer}
                              dangerouslySetInnerHTML={{ __html: activeRecipe.iframeHtml }}
                            />
                          </div>
                        ) : (
                          <div
                            className={styles.videoFacade}
                            onClick={() => setPlayVideoId(activeRecipe.id)}
                            title="Tap to load video preview"
                          >
                            <span className={styles.videoFacadeBadge}>TIKTOK FEED 🎬</span>
                            <div className={styles.videoFacadePlayBtn}>
                              <span className={styles.playIcon}>▶</span>
                            </div>
                            <span className={styles.videoFacadeText}>Load Video Feed</span>
                            <span className={styles.videoFacadeSub}>Tapping pulls tracking scripts and video media</span>
                          </div>
                        )
                      ) : activeRecipe.videoUrl ? (
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

                    {/* Health Score Banner */}
                    {activeRecipe.nutrition?.healthScore && (
                      <div className={styles.healthBanner}>
                        <div className={styles.healthScoreWrap}>
                          <span className={styles.healthScoreNum}>{activeRecipe.nutrition.healthScore}<span className={styles.healthScoreOf}>/10</span></span>
                          <span className={styles.healthLabel}>{activeRecipe.nutrition.healthLabel || 'Health Score'}</span>
                        </div>
                        <div className={styles.healthScoreBar}>
                          <div
                            className={styles.healthScoreFill}
                            style={{ width: `${(activeRecipe.nutrition.healthScore / 10) * 100}%` }}
                          />
                        </div>
                        {activeRecipe.nutrition.healthSummary && (
                          <p className={styles.healthSummary}>{activeRecipe.nutrition.healthSummary}</p>
                        )}
                      </div>
                    )}

                    {/* Benefits & Warnings */}
                    {((activeRecipe.nutrition?.benefits?.length > 0) || (activeRecipe.nutrition?.warnings?.length > 0)) && (
                      <div className={styles.healthChipsRow}>
                        {activeRecipe.nutrition?.benefits?.map((b, i) => (
                          <span key={i} className={styles.benefitChip}>✓ {b}</span>
                        ))}
                        {activeRecipe.nutrition?.warnings?.map((w, i) => (
                          <span key={i} className={styles.warningChip}>⚠ {w}</span>
                        ))}
                      </div>
                    )}


                    {/* Macro Grid */}
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
                      {activeRecipe.nutrition?.sodium && (
                        <div className={`${styles.nutritionCard} ${styles.fatCard}`}>
                          <span className={styles.nutritionVal}>{activeRecipe.nutrition.sodium}</span>
                          <span className={styles.nutritionLabel}>Sodium</span>
                          <div className={styles.macroIndicator} style={{ background: '#f59e0b' }}></div>
                        </div>
                      )}
                      {activeRecipe.nutrition?.sugar && (
                        <div className={`${styles.nutritionCard} ${styles.calCard}`}>
                          <span className={styles.nutritionVal}>{activeRecipe.nutrition.sugar}</span>
                          <span className={styles.nutritionLabel}>Sugar</span>
                          <div className={styles.macroIndicator} style={{ background: '#ec4899' }}></div>
                        </div>
                      )}
                    </div>

                    <div className={styles.nutritionDisclaimer}>
                      <span className={styles.disclaimerIcon}>⚠️</span>
                      <span>Macros and health analysis are estimated by Gemini AI. For precise medical dietary guidance, consult a professional.</span>
                    </div>
                  </div>
                )}

              </div>
            </div>
          ) : (
            <div className={styles.emptyDetailState}>
              <span className={styles.emptyStateIcon}>🍔</span>
              <h3>Your Kitchen Awaits</h3>
              <p>Select a recipe from the Order Board, or paste a TikTok / Instagram video link to scan a new one.</p>
            </div>
          )}
        </section>
      </main>

      {/* Sticky Bottom Tab Bar */}
      <nav className={styles.bottomTabBar}>
        <button
          className={`${styles.tabBarItem} ${viewMode === 'list' ? styles.tabBarItemActive : ''}`}
          onClick={() => setViewMode('list')}
        >
          <span className={styles.tabBarIcon}>📋</span>
          <span className={styles.tabBarLabel}>Board</span>
        </button>
        <button
          className={styles.tabBarItem}
          onClick={() => setIsImportOpen(true)}
        >
          <span className={styles.tabBarIcon}>⚡</span>
          <span className={styles.tabBarLabel}>Scan</span>
        </button>
        <button
          className={styles.tabBarItem}
          onClick={() => {
            if (!user) {
              setIsAuthOpen(true);
            } else {
              setShareTarget(null);
              setIsFriendsOpen(true);
            }
          }}
        >
          <span className={styles.tabBarIcon}>👥</span>
          <span className={styles.tabBarLabel}>Friends</span>
          {pendingCount > 0 && <span className={styles.tabBarBadge}>{pendingCount}</span>}
        </button>
        {user ? (
          <button
            className={styles.tabBarItem}
            onClick={() => setIsInboxOpen(true)}
          >
            <span className={styles.tabBarIcon}>📬</span>
            <span className={styles.tabBarLabel}>Inbox</span>
            {unreadInbox > 0 && <span className={styles.tabBarBadge}>{unreadInbox}</span>}
          </button>
        ) : (
          <button
            className={styles.tabBarItem}
            onClick={() => setIsAuthOpen(true)}
          >
            <span className={styles.tabBarIcon}>☁️</span>
            <span className={styles.tabBarLabel}>Sync</span>
          </button>
        )}
      </nav>
    </div>
  );
}
