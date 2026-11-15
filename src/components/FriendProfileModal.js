'use client';

import { useState, useEffect } from 'react';
import {
  X,
  ChefHat,
  MessageCircle,
  BookOpen,
  BookmarkPlus,
  Check,
  Clock,
  Flame,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import styles from './FriendProfileModal.module.css';
import DishIllustration, { resolveDishVisual } from './DishIllustration';
import { getUserSavedRecipes } from '@/lib/friends';
import { formatCompactDuration } from '@/lib/recipeFormat';

function Avatar({ user, size = 64 }) {
  const displayName = user?.displayName || user?.email || '?';
  if (user?.photoURL) {
    return (
      <img
        src={user.photoURL}
        alt={displayName}
        className={styles.avatar}
        style={{ width: size, height: size }}
        referrerPolicy="no-referrer"
      />
    );
  }
  const letter = displayName.charAt(0).toUpperCase();
  return (
    <div
      className={styles.avatarInitial}
      style={{ width: size, height: size, fontSize: size * 0.44 }}
      aria-hidden="true"
    >
      {letter}
    </div>
  );
}

export default function FriendProfileModal({
  friend,
  onClose,
  onOpenChat,
  onSelectRecipe,
  onSaveRecipe,
}) {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savedRecipes, setSavedRecipes] = useState(new Set());

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!friend?.uid) return;
    let active = true;
    queueMicrotask(() => {
      if (active) setLoading(true);
    });
    getUserSavedRecipes(friend.uid).then((res) => {
      if (!active) return;
      setRecipes(res);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [friend?.uid]);

  const handleSaveRecipeClick = async (recipe) => {
    if (savedRecipes.has(recipe.id)) return;
    if (onSaveRecipe) {
      await onSaveRecipe(recipe);
      setSavedRecipes((prev) => new Set([...prev, recipe.id]));
    }
  };

  if (!friend) return null;

  const displayName = friend.displayName || friend.email?.split('@')[0] || 'Chef Friend';
  const firstName = displayName.split(' ')[0];
  const handleTag = `@${friend.displayName ? friend.displayName.toLowerCase().replace(/\s+/g, '') : friend.email?.split('@')[0]}`;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="friend-profile-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Warm Sand Profile Banner */}
        <div className={styles.profileHeader}>
          <div className={styles.topUtilityRow}>
            <span className={styles.profilePill}>
              <ChefHat size={13} strokeWidth={2.5} aria-hidden="true" />
              <span>CHEF PROFILE</span>
            </span>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Close profile"
              title="Close Profile"
            >
              <X size={18} strokeWidth={2.5} aria-hidden="true" />
            </button>
          </div>

          <div className={styles.identityRow}>
            <Avatar user={friend} size={68} />
            <div className={styles.profileMeta}>
              <h2 id="friend-profile-title" className={styles.displayName}>
                {displayName}
              </h2>
              <span className={styles.handleTag}>{handleTag}</span>
              <span className={styles.chefBadge}>Cheffone Member</span>
            </div>

            {onOpenChat && (
              <div className={styles.headerActions}>
                <button
                  type="button"
                  className={styles.chatBtn}
                  onClick={() => {
                    onClose();
                    onOpenChat(friend);
                  }}
                >
                  <MessageCircle size={15} strokeWidth={2.4} aria-hidden="true" />
                  <span>Chat with {firstName}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Recipes Section */}
        <div className={styles.recipesSection}>
          <div className={styles.sectionTitleRow}>
            <h3 className={styles.sectionTitle}>
              <BookOpen size={17} strokeWidth={2.4} aria-hidden="true" />
              <span>{firstName}&apos;s Saved Recipes</span>
            </h3>
            <span className={styles.countBadge}>
              {recipes.length} {recipes.length === 1 ? 'RECIPE' : 'RECIPES'}
            </span>
          </div>

          <div className={styles.recipesGrid}>
            {loading ? (
              <div className={styles.loadingState}>
                <span className={styles.spinner} />
                <span>Loading saved recipes...</span>
              </div>
            ) : recipes.length === 0 ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon} aria-hidden="true">
                  <UtensilsCrossed size={34} strokeWidth={2} />
                </span>
                <p>This chef hasn&apos;t saved any public recipes yet.</p>
              </div>
            ) : (
              recipes.map((r) => {
                const visual = resolveDishVisual(r);
                const isAlreadySaved = savedRecipes.has(r.id);

                return (
                  <div key={r.id || r.title} className={styles.recipeCard}>
                    <div className={styles.recipeCardTop}>
                      <div
                        className={styles.recipeThumb}
                        style={{ backgroundColor: visual.backdrop }}
                      >
                        <DishIllustration recipe={r} />
                      </div>

                      <div className={styles.recipeCardBody}>
                        <div className={styles.recipeCardHeader}>
                          <span className={styles.categoryBadge}>
                            {r.category || 'Recipe'}
                          </span>
                          <span className={styles.recipeTag}>SAVED</span>
                        </div>

                        <h4 className={styles.recipeTitle}>{r.title}</h4>

                        <div className={styles.recipeStats}>
                          {r.prepTime && (
                            <span className={styles.statItem}>
                              <Clock size={12} strokeWidth={2.3} aria-hidden="true" />
                              <span>{formatCompactDuration(r.prepTime)}</span>
                            </span>
                          )}
                          {r.difficulty && (
                            <span className={styles.statItem}>
                              <Flame size={12} strokeWidth={2.3} aria-hidden="true" />
                              <span>{r.difficulty}</span>
                            </span>
                          )}
                          {r.servings && (
                            <span className={styles.statItem}>
                              <Users size={12} strokeWidth={2.3} aria-hidden="true" />
                              <span>{r.servings} serv</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className={styles.recipeCardActions}>
                      {onSelectRecipe && (
                        <button
                          type="button"
                          className={styles.viewBtn}
                          onClick={() => onSelectRecipe(r)}
                        >
                          <BookOpen size={14} strokeWidth={2.3} aria-hidden="true" />
                          <span>View Recipe</span>
                        </button>
                      )}
                      {onSaveRecipe && (
                        <button
                          type="button"
                          className={`${styles.saveBtn} ${isAlreadySaved ? styles.savedBtn : ''}`}
                          onClick={() => handleSaveRecipeClick(r)}
                          disabled={isAlreadySaved}
                        >
                          {isAlreadySaved ? (
                            <>
                              <Check size={14} strokeWidth={2.6} aria-hidden="true" />
                              <span>Saved</span>
                            </>
                          ) : (
                            <>
                              <BookmarkPlus size={14} strokeWidth={2.3} aria-hidden="true" />
                              <span>Save to Mine</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
