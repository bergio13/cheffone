'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Zap,
  MessageCircle,
  Users,
  Cloud,
  Download,
  LogOut,
  BookMarked,
  User,
  Loader2,
  WifiOff,
} from 'lucide-react';
import styles from './page.module.css';
import { useAuth } from '@/lib/authContext';
import { useRecipes } from '@/lib/useRecipes';
import { parseLaunchIntent } from '@/lib/shareIntent';
import { needsDishVisualBackfill } from '@/lib/dishVisual';
import { compressDishImageDataUrl } from '@/lib/compressDishImage';
import AuthModal from '@/components/AuthModal';
import ImportModal from '@/components/ImportModal';
import Sidebar from '@/components/Sidebar';
import RecipeDetail from '@/components/RecipeDetail';
import ThemeToggle from '@/components/ThemeToggle';
import FriendsModal from '@/components/FriendsModal';
import ChatModal from '@/components/ChatModal';
import FriendProfileModal from '@/components/FriendProfileModal';
import PWAInstallPrompt, { triggerInstallModal } from '@/components/PWAInstallPrompt';
import {
  getFriends,
  getPendingRequests,
  getParseLimitStatus,
  incrementParseCount,
  subscribeToUserChats,
} from '@/lib/friends';

const LOADER_TIPS = [
  'Firing up the grill...',
  'Slicing pickles and shredding lettuce...',
  'Consulting the secret recipe book...',
  'Calculating calorie counts for your meal...',
  'Plating the digital burger card...',
  'Squeezing the ketchup and mustard...',
];

const DAILY_PARSE_LIMIT = 5;
const ALLOWED_DOMAINS = ['instagram.com', 'instagr.am', 'tiktok.com', 'vm.tiktok.com'];

export default function Home() {
  const { user, signOut } = useAuth();

  // Recipe collection + selection
  const [activeRecipeId, setActiveRecipeId] = useState(null);
  const [adjustedServings, setAdjustedServings] = useState(2);
  const [checkedIngredients, setCheckedIngredients] = useState({});
  const [activeTab, setActiveTab] = useState('recipe');
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'detail'
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [playVideoId, setPlayVideoId] = useState(null);
  const [previewRecipe, setPreviewRecipe] = useState(null);
  const [previewFromFriend, setPreviewFromFriend] = useState(null);

  const handleRecipesLoaded = useCallback((loaded) => {
    if (loaded.length > 0) {
      setActiveRecipeId(loaded[0].id);
      setAdjustedServings(loaded[0].servings || 2);
    }
  }, []);
  const { recipes, isSyncing, saveRecipe, updateRecipeVisuals, removeRecipe, clearRecipes } = useRecipes(user, handleRecipesLoaded);

  // Import / parse
  const [url, setUrl] = useState('');
  const [rawText, setRawText] = useState('');
  const [scanTab, setScanTab] = useState('link'); // 'link' | 'text'
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaderTipIndex, setLoaderTipIndex] = useState(0);
  const [error, setError] = useState('');

  // Auth / UI
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [pendingChatLaunch, setPendingChatLaunch] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);
  const userMenuRef = useRef(null);
  const attemptedVisualKeysRef = useRef(new Set());

  // Social
  const [isFriendsOpen, setIsFriendsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeChatFriend, setActiveChatFriend] = useState(null);
  const [activeFriendProfile, setActiveFriendProfile] = useState(null);
  const [shareTarget, setShareTarget] = useState(null);
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [userChats, setUserChats] = useState([]);

  const activeRecipe = previewRecipe || recipes.find((r) => r.id === activeRecipeId);

  const showToast = (msg) => {
    clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(''), 3000);
  };
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // Reset video preview when the active recipe changes
  useEffect(() => {
    queueMicrotask(() => setPlayVideoId(null));
  }, [activeRecipeId, previewRecipe?.id]);

  // Social data follows auth state
  useEffect(() => {
    if (user === undefined) return;
    if (user) {
      getFriends(user.uid).then(setFriends);
      getPendingRequests(user.uid).then(setPendingRequests);
    } else {
      queueMicrotask(() => {
        setFriends([]);
        setPendingRequests([]);
        setUserChats([]);
      });
    }
  }, [user]);

  // Network connectivity tracking for mobile offline cooking mode
  useEffect(() => {
    const syncStatus = () => setIsOffline(!navigator.onLine);
    queueMicrotask(syncStatus);
    window.addEventListener('online', syncStatus);
    window.addEventListener('offline', syncStatus);
    return () => {
      window.removeEventListener('online', syncStatus);
      window.removeEventListener('offline', syncStatus);
    };
  }, []);

  // Close user menu on outside tap/click
  useEffect(() => {
    if (!showUserMenu) return;
    const handleOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [showUserMenu]);

  // Escape key closes topmost open overlay or dropdown
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (showUserMenu) setShowUserMenu(false);
      else if (activeFriendProfile) setActiveFriendProfile(null);
      else if (isChatOpen) {
        setIsChatOpen(false);
        setActiveChatFriend(null);
      } else if (isFriendsOpen) {
        setIsFriendsOpen(false);
        setShareTarget(null);
      } else if (isImportOpen) setIsImportOpen(false);
      else if (isAuthOpen) setIsAuthOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showUserMenu, activeFriendProfile, isChatOpen, isFriendsOpen, isImportOpen, isAuthOpen]);

  // PWA shortcuts (?action=scan|recipes|chat) and Web Share Target (?url=&text=&title=)
  useEffect(() => {
    const intent = parseLaunchIntent(window.location.search);
    if (!intent) return;

    queueMicrotask(() => {
      if (intent.type === 'open_scan') {
        setIsImportOpen(true);
      } else if (intent.type === 'open_recipes') {
        setViewMode('list');
        setSidebarOpen(true);
      } else if (intent.type === 'open_chat') {
        setPendingChatLaunch(true);
      } else if (intent.type === 'share_import') {
        setScanTab(intent.scanTab);
        if (intent.url) setUrl(intent.url);
        if (intent.rawText) setRawText(intent.rawText);
        setError('');
        setIsImportOpen(true);
      }
    });

    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  useEffect(() => {
    if (!pendingChatLaunch || user === undefined) return;
    queueMicrotask(() => {
      setPendingChatLaunch(false);
      if (user) {
        setIsChatOpen(true);
      } else {
        setIsAuthOpen(true);
        showToast('Sign in to open Kitchen Chat');
      }
    });
  }, [pendingChatLaunch, user]);

  useEffect(() => {
    if (!user) return;
    return subscribeToUserChats(user.uid, setUserChats);
  }, [user]);

  const isMountedRef = useRef(true);
  const isIllustratingRef = useRef(false);
  const pendingBackfillRef = useRef(false);
  const [backfillTick, setBackfillTick] = useState(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    attemptedVisualKeysRef.current.clear();
  }, [user?.uid]);

  // Retroactively generate title-based AI image illustrations for all saved recipes
  useEffect(() => {
    if (isOffline || recipes.length === 0) return;
    if (isIllustratingRef.current) {
      pendingBackfillRef.current = true;
      return;
    }

    const pending = recipes.filter((r) => {
      if (!needsDishVisualBackfill(r)) return false;
      const attemptKey = `${r.id}:${r.title}`;
      return !attemptedVisualKeysRef.current.has(attemptKey);
    });

    if (pending.length === 0) return;

    isIllustratingRef.current = true;

    (async () => {
      try {
        const CHUNK_SIZE = 3;
        let queue = [...pending];
        let rateLimitRetries = 0;

        while (queue.length > 0) {
          if (!isMountedRef.current || (typeof navigator !== 'undefined' && !navigator.onLine)) {
            break;
          }
          const batch = queue.slice(0, CHUNK_SIZE);
          const res = await fetch('/api/illustrate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipes: batch.map((r) => ({
                id: r.id,
                title: r.title,
                category: r.category,
                illustrationDescription:
                  r.illustrationDescription || r.dishVisual?.illustrationDescription || '',
                ingredients: Array.isArray(r.ingredients)
                  ? r.ingredients.slice(0, 6).map((ing) => ing?.name).filter(Boolean)
                  : [],
              })),
            }),
          });

          if (res.status === 429) {
            const errBody = await res.json().catch(() => ({}));
            const retrySec = Number(errBody?.retryAfterSeconds);
            if (Number.isFinite(retrySec) && retrySec > 0 && retrySec <= 50 && rateLimitRetries < 2) {
              rateLimitRetries += 1;
              await new Promise((resolve) => setTimeout(resolve, (retrySec + 1) * 1000));
              continue;
            }
            console.warn('Stopping dish illustration backfill:', errBody?.error || res.status);
            break;
          }
          if (res.status === 503) {
            const errBody = await res.json().catch(() => ({}));
            console.warn('Stopping dish illustration backfill:', errBody?.error || res.status);
            break;
          }
          if (!res.ok) {
            batch.forEach((r) => attemptedVisualKeysRef.current.add(`${r.id}:${r.title}`));
            queue = queue.slice(batch.length);
            continue;
          }

          rateLimitRetries = 0;
          const data = await res.json();
          const visuals = data?.visuals || {};
          const returnedIds = new Set(Object.keys(visuals));
          if (returnedIds.size === 0) {
            batch.forEach((r) => attemptedVisualKeysRef.current.add(`${r.id}:${r.title}`));
            queue = queue.slice(batch.length);
            continue;
          }

          const compressedVisuals = {};
          for (const [id, visual] of Object.entries(visuals)) {
            const matched = batch.find((r) => String(r.id) === id);
            if (matched) {
              attemptedVisualKeysRef.current.add(`${matched.id}:${matched.title}`);
            }
            if (visual?.imageUrl) {
              compressedVisuals[id] = {
                ...visual,
                imageUrl: await compressDishImageDataUrl(visual.imageUrl),
              };
            }
          }
          if (isMountedRef.current && Object.keys(compressedVisuals).length > 0) {
            await updateRecipeVisuals(compressedVisuals);
          }
          queue = queue.filter((r) => !returnedIds.has(String(r.id)));
        }
      } catch (err) {
        console.error('Retroactive dish illustration error:', err);
      } finally {
        isIllustratingRef.current = false;
        if (pendingBackfillRef.current && isMountedRef.current) {
          pendingBackfillRef.current = false;
          setBackfillTick((n) => n + 1);
        }
      }
    })();
  }, [recipes, isOffline, updateRecipeVisuals, backfillTick]);

  // TikTok embed script re-evaluation
  useEffect(() => {
    if (!activeRecipe?.iframeHtml) return;
    document.getElementById('tiktok-embed-script')?.remove();
    if (typeof window.tiktok?.embed?.render === 'function') {
      window.tiktok.embed.render();
    } else {
      const script = document.createElement('script');
      script.id = 'tiktok-embed-script';
      script.src = 'https://www.tiktok.com/embed.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, [activeRecipeId, activeRecipe?.iframeHtml]);

  // Rotate loader tips
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => setLoaderTipIndex((p) => (p + 1) % LOADER_TIPS.length), 3000);
    return () => clearInterval(interval);
  }, [loading]);

  // ── Selection helpers ──────────────────────────────────────────────────────
  const selectRecipe = (r) => {
    setPreviewRecipe(null);
    setPreviewFromFriend(null);
    setActiveRecipeId(r.id);
    setViewMode('detail');
    setAdjustedServings(r.servings || 2);
    setCheckedIngredients({});
  };

  // Open a recipe received from a friend: switch to the saved copy, or preview it.
  const openSharedRecipe = (recipe) => {
    const saved = recipes.find((r) => r.id === recipe.id);
    if (saved) {
      setPreviewRecipe(null);
      setActiveRecipeId(saved.id);
    } else {
      setPreviewRecipe({ ...recipe, isPreviewOnly: true });
    }
    setAdjustedServings(recipe.servings || 2);
    setViewMode('detail');
  };

  // ── Parse recipe ───────────────────────────────────────────────────────────
  const handleParseRecipe = async (e) => {
    e.preventDefault();
    if (isOffline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      setError('You are offline. Reconnect to parse a new recipe.');
      return;
    }
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
        const host = new URL(url.trim()).hostname.toLowerCase();
        if (!ALLOWED_DOMAINS.some((d) => host === d || host.endsWith('.' + d))) {
          setError('Only TikTok and Instagram links are supported.');
          return;
        }
      } catch {
        setError('Please enter a valid URL.');
        return;
      }
    }

    try {
      const limitStatus = await getParseLimitStatus(user.uid, DAILY_PARSE_LIMIT);
      if (!limitStatus.allowed) {
        setError(`Daily limit reached! You can parse up to ${DAILY_PARSE_LIMIT} recipes per day.`);
        return;
      }
    } catch (err) {
      console.error('Failed to check parse limit:', err);
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
      const rawBody = await response.text();
      let data = {};
      try {
        data = rawBody ? JSON.parse(rawBody) : {};
      } catch {
        data = {};
      }
      if (!response.ok) {
        throw new Error(
          data.error || `Failed to parse recipe (HTTP ${response.status}). Please try again.`
        );
      }
      if (!data.recipe) throw new Error('API returned successfully but no recipe data was parsed.');

      const compressedDishVisual = data.recipe?.dishVisual?.imageUrl
        ? {
            ...data.recipe.dishVisual,
            imageUrl: await compressDishImageDataUrl(data.recipe.dishVisual.imageUrl),
          }
        : data.recipe?.dishVisual;

      const newRecipe = {
        ...data.recipe,
        ...(compressedDishVisual ? { dishVisual: compressedDishVisual } : {}),
        id: Date.now().toString(),
        sourceUrl: url,
        videoUrl: data.metadata?.videoUrl || '',
        iframeHtml: data.metadata?.htmlContent || '',
        parsedAt: new Date().toISOString(),
      };

      await saveRecipe(newRecipe);
      setPreviewRecipe(null);
      setActiveRecipeId(newRecipe.id);
      setViewMode('detail');
      setAdjustedServings(newRecipe.servings || 2);
      setCheckedIngredients({});
      setUrl('');
      setRawText('');
      setActiveTab('recipe');
      setIsImportOpen(false);

      try {
        await incrementParseCount(user.uid);
      } catch (err) {
        console.error('Failed to increment parse count:', err);
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRecipe = async (id) => {
    const remaining = recipes.filter((r) => r.id !== id);
    await removeRecipe(id);
    if (activeRecipeId === id) {
      setViewMode('list');
      setActiveRecipeId(remaining[0]?.id ?? null);
      if (remaining[0]) setAdjustedServings(remaining[0].servings || 2);
      setCheckedIngredients({});
    }
  };

  // ── Social handlers ────────────────────────────────────────────────────────
  const handleShareRecipe = (recipe) => {
    if (!user) {
      setIsAuthOpen(true);
      return;
    }
    setShareTarget(recipe);
    setIsFriendsOpen(true);
  };

  const handleSaveSharedRecipe = async (recipe) => {
    const newRecipe = {
      ...recipe,
      id: Date.now().toString(),
      parsedAt: recipe.parsedAt || new Date().toISOString(),
      savedFromFriend: true,
    };
    delete newRecipe.isPreviewOnly;
    await saveRecipe(newRecipe);
    setActiveRecipeId(newRecipe.id);
    setAdjustedServings(newRecipe.servings || 2);
    showToast('Recipe saved to your collection!');
  };

  const totalUnreadChats = userChats.filter((c) => c.unreadBy?.includes(user?.uid)).length;
  const pendingCount = pendingRequests.length;

  const openChat = (friend = null) => {
    setActiveChatFriend(friend);
    setIsChatOpen(true);
  };
  const openFriends = () => {
    setShareTarget(null);
    setIsFriendsOpen(true);
  };

  const renderUserChip = () => {
    if (user === undefined) return null;
    if (!user) {
      return (
        <>
          <button className={styles.syncButton} onClick={() => setIsAuthOpen(true)} title="Sign in to sync your recipes">
            <Cloud size={16} /> Sync Recipes
          </button>
          <button
            className={styles.mobileAvatarBtn}
            onClick={() => setIsAuthOpen(true)}
            aria-label="Sign in to sync recipes"
            title="Sign in"
          >
            <User size={19} />
          </button>
        </>
      );
    }
    const initials = (user.displayName || user.email || '?').charAt(0).toUpperCase();
    return (
      <div className={styles.userChipWrapper} ref={userMenuRef}>
        <button
          className={styles.userChip}
          onClick={() => setShowUserMenu((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={showUserMenu}
          title={user.displayName || user.email}
        >
          {user.photoURL ? (
            <img src={user.photoURL} alt="" className={styles.userAvatar} referrerPolicy="no-referrer" />
          ) : (
            <span className={styles.userInitials}>{initials}</span>
          )}
          <span className={styles.userName}>{user.displayName || user.email?.split('@')[0]}</span>
          {isSyncing && <span className={styles.syncDot} title="Syncing..." />}
        </button>
        {showUserMenu && (
          <div className={styles.userMenu} role="menu">
            <div className={styles.userMenuHeader}>
              <div className={styles.userMenuName}>{user.displayName || 'Chef Member'}</div>
              <div className={styles.userMenuUsername}>
                @{user.displayName ? user.displayName.toLowerCase().replace(/\s+/g, '') : user.email?.split('@')[0]}
              </div>
              <div className={styles.userMenuEmail}>{user.email}</div>
            </div>
            <button
              className={styles.userMenuItem}
              role="menuitem"
              onClick={() => {
                setShowUserMenu(false);
                triggerInstallModal();
              }}
            >
              <Download size={16} /> Install App
            </button>
            <button
              className={styles.userMenuSignOut}
              role="menuitem"
              onClick={async () => {
                await signOut();
                setShowUserMenu(false);
                clearRecipes();
                setActiveRecipeId(null);
              }}
            >
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      {isAuthOpen && <AuthModal onClose={() => setIsAuthOpen(false)} />}

      {isFriendsOpen && (
        <FriendsModal
          currentUser={user}
          onClose={() => {
            setIsFriendsOpen(false);
            setShareTarget(null);
          }}
          recipeToShare={shareTarget}
          onShared={(friendName) => showToast(`Recipe sent in chat to ${friendName}!`)}
          onOpenChat={(friend) => {
            setIsFriendsOpen(false);
            openChat(friend);
          }}
          onOpenProfile={(friend) => {
            setIsFriendsOpen(false);
            setPreviewRecipe(null);
            setPreviewFromFriend(null);
            setActiveFriendProfile(friend);
          }}
        />
      )}

      {isChatOpen && (
        <ChatModal
          currentUser={user}
          initialFriend={activeChatFriend}
          onClose={() => {
            setIsChatOpen(false);
            setActiveChatFriend(null);
          }}
          onSelectRecipe={(recipe) => {
            setIsChatOpen(false);
            setIsFriendsOpen(false);
            setActiveFriendProfile(null);
            openSharedRecipe(recipe);
          }}
          onSaveRecipe={handleSaveSharedRecipe}
          onOpenProfile={(friend) => {
            setIsChatOpen(false);
            setPreviewRecipe(null);
            setPreviewFromFriend(null);
            setActiveFriendProfile(friend);
          }}
        />
      )}

      {activeFriendProfile && (
        <FriendProfileModal
          friend={activeFriendProfile}
          currentUser={user}
          onClose={() => {
            setActiveFriendProfile(null);
            setPreviewRecipe(null);
            setPreviewFromFriend(null);
            setViewMode('list');
          }}
          onOpenChat={(friend) => {
            setActiveFriendProfile(null);
            setIsFriendsOpen(false);
            openChat(friend);
          }}
          onSelectRecipe={(recipe) => {
            setPreviewFromFriend(activeFriendProfile);
            setActiveFriendProfile(null);
            setIsFriendsOpen(false);
            setIsChatOpen(false);
            openSharedRecipe(recipe);
          }}
          onSaveRecipe={handleSaveSharedRecipe}
        />
      )}

      {toast && (
        <div className={styles.toast} role="status">
          {toast}
        </div>
      )}

      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.fastFoodIcon}>🍔</span>
          <div className={styles.logoText}>
            <h1>Cheffone</h1>
          </div>
        </div>
        <div className={styles.headerActions}>
          <ThemeToggle className={`${styles.socialBtn} ${styles.themeToggleBtn}`} />
          {user && (
            <>
              <button className={styles.socialBtn} onClick={() => openChat()} aria-label="Kitchen Chat" title="Kitchen Chat">
                <MessageCircle size={18} />
                {totalUnreadChats > 0 && <span className={styles.socialBadge}>{totalUnreadChats}</span>}
              </button>
              <button className={styles.socialBtn} onClick={openFriends} aria-label="Friends" title="Friends">
                <Users size={18} />
                {pendingCount > 0 && <span className={styles.socialBadge}>{pendingCount}</span>}
              </button>
            </>
          )}
          {renderUserChip()}
          <button onClick={() => setIsImportOpen(true)} className={`${styles.primaryButton} ${styles.headerScanBtn}`}>
            <Zap size={18} /> Scan New Recipe
          </button>
        </div>
      </header>

      {isOffline && (
        <div className={styles.offlineBanner} role="status" aria-live="polite">
          <WifiOff size={16} />
          <span>Offline mode — your saved recipes and checklists remain available.</span>
        </div>
      )}

      {isImportOpen && (
        <ImportModal
          onClose={() => setIsImportOpen(false)}
          scanTab={scanTab}
          setScanTab={setScanTab}
          url={url}
          setUrl={setUrl}
          rawText={rawText}
          setRawText={setRawText}
          loading={loading}
          error={error}
          onSubmit={handleParseRecipe}
        />
      )}

      {loading && (
        <div className={styles.loaderOverlay} role="status" aria-live="polite">
          <div className={styles.loaderContainer}>
            <div className={styles.loaderSpinner}>
              <div className={styles.loaderInnerRing}></div>
            </div>
            <p className={styles.loaderStatusText}>GRILLING YOUR RECIPE CARD...</p>
            <div className={styles.loaderTip}>{LOADER_TIPS[loaderTipIndex]}</div>
          </div>
        </div>
      )}

      <main
        className={`${styles.mainLayout} ${!sidebarOpen ? styles.mainLayoutCollapsed : ''} ${
          viewMode === 'detail' ? styles.mobileShowDetail : styles.mobileShowList
        }`}
      >
        <Sidebar
          recipes={recipes}
          activeRecipeId={activeRecipeId}
          open={sidebarOpen}
          onToggle={() => setSidebarOpen((v) => !v)}
          onSelect={selectRecipe}
          onDelete={handleDeleteRecipe}
          onExpand={() => setSidebarOpen(true)}
          onExpandAndSelect={(r) => {
            selectRecipe(r);
            setSidebarOpen(true);
          }}
        />

        <section className={styles.recipeDetailContainer}>
          <RecipeDetail
            recipe={activeRecipe}
            isSaved={!!activeRecipe && recipes.some((r) => r.id === activeRecipe.id)}
            previewFromFriend={previewFromFriend}
            adjustedServings={adjustedServings}
            setAdjustedServings={setAdjustedServings}
            checkedIngredients={checkedIngredients}
            onToggleIngredient={(i) => setCheckedIngredients((p) => ({ ...p, [i]: !p[i] }))}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            playVideoId={playVideoId}
            setPlayVideoId={setPlayVideoId}
            onBack={() => {
              if (previewFromFriend) {
                const f = previewFromFriend;
                setPreviewRecipe(null);
                setPreviewFromFriend(null);
                setActiveFriendProfile(f);
              } else {
                setViewMode('list');
              }
            }}
            onSaveShared={() => {
              handleSaveSharedRecipe(activeRecipe);
              setPreviewRecipe(null);
            }}
            onShare={() => handleShareRecipe(activeRecipe)}
          />
        </section>
      </main>

      <nav className={styles.bottomTabBar} aria-label="Primary">
        <button
          className={`${styles.tabBarItem} ${
            viewMode === 'list' && !isImportOpen && !isFriendsOpen && !isChatOpen && !isAuthOpen && !activeFriendProfile
              ? styles.tabBarItemActive
              : ''
          }`}
          aria-current={viewMode === 'list' && !isImportOpen && !isFriendsOpen && !isChatOpen ? 'page' : undefined}
          onClick={() => {
            setIsImportOpen(false);
            setIsFriendsOpen(false);
            setIsChatOpen(false);
            setIsAuthOpen(false);
            setActiveFriendProfile(null);
            setViewMode('list');
          }}
        >
          <span className={styles.tabBarIcon}><BookMarked size={21} /></span>
          <span className={styles.tabBarLabel}>Board</span>
        </button>
        <button
          className={`${styles.tabBarItem} ${isImportOpen ? styles.tabBarItemActive : ''}`}
          aria-pressed={isImportOpen}
          onClick={() => setIsImportOpen(true)}
        >
          <span className={styles.tabBarIcon}><Zap size={22} /></span>
          <span className={styles.tabBarLabel}>Scan</span>
        </button>
        <button
          className={`${styles.tabBarItem} ${isFriendsOpen ? styles.tabBarItemActive : ''}`}
          aria-pressed={isFriendsOpen}
          onClick={() => (user ? openFriends() : setIsAuthOpen(true))}
        >
          <span className={styles.tabBarIcon}><Users size={22} /></span>
          <span className={styles.tabBarLabel}>Friends</span>
          {pendingCount > 0 && <span className={styles.tabBarBadge}>{pendingCount}</span>}
        </button>
        {user ? (
          <button
            className={`${styles.tabBarItem} ${isChatOpen ? styles.tabBarItemActive : ''}`}
            aria-pressed={isChatOpen}
            onClick={() => openChat()}
          >
            <span className={styles.tabBarIcon}><MessageCircle size={22} /></span>
            <span className={styles.tabBarLabel}>Chat</span>
            {totalUnreadChats > 0 && <span className={styles.tabBarBadge}>{totalUnreadChats}</span>}
          </button>
        ) : (
          <button
            className={`${styles.tabBarItem} ${isAuthOpen ? styles.tabBarItemActive : ''}`}
            aria-pressed={isAuthOpen}
            onClick={() => setIsAuthOpen(true)}
          >
            <span className={styles.tabBarIcon}><Cloud size={22} /></span>
            <span className={styles.tabBarLabel}>Sync</span>
          </button>
        )}
      </nav>

      <PWAInstallPrompt />
    </div>
  );
}
