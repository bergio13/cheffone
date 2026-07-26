'use client';

import { useState, useEffect } from 'react';
import styles from './FriendProfileModal.module.css';
import { getUserSavedRecipes } from '@/lib/friends';

function Avatar({ user, size = 64 }) {
  if (user?.photoURL) {
    return (
      <img
        src={user.photoURL}
        alt={user.displayName || user.email}
        className={styles.avatar}
        style={{ width: size, height: size }}
        referrerPolicy="no-referrer"
      />
    );
  }
  const letter = (user?.displayName || user?.email || '?').charAt(0).toUpperCase();
  return (
    <div className={styles.avatarInitial} style={{ width: size, height: size, fontSize: size * 0.45 }}>
      {letter}
    </div>
  );
}

export default function FriendProfileModal({
  friend,
  currentUser,
  onClose,
  onOpenChat,
  onSelectRecipe,
  onSaveRecipe,
}) {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savedRecipes, setSavedRecipes] = useState(new Set());

  useEffect(() => {
    if (!friend?.uid) return;
    setLoading(true);
    getUserSavedRecipes(friend.uid).then((res) => {
      setRecipes(res);
      setLoading(false);
    });
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
  const handleTag = `@${friend.displayName ? friend.displayName.toLowerCase().replace(/\s+/g, '') : friend.email?.split('@')[0]}`;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose} title="Close Profile">
          ✕
        </button>

        {/* Profile Card Header */}
        <div className={styles.profileHeader}>
          <Avatar user={friend} size={72} />
          <div className={styles.profileMeta}>
            <h2 className={styles.displayName}>{displayName}</h2>
            <span className={styles.handleTag}>{handleTag}</span>
            <span className={styles.chefBadge}>👨‍🍳 Cheffone Member</span>
          </div>

          <div className={styles.headerActions}>
            {onOpenChat && (
              <button
                className={styles.chatBtn}
                onClick={() => {
                  onClose();
                  onOpenChat(friend);
                }}
              >
                💬 Chat with {displayName.split(' ')[0]}
              </button>
            )}
          </div>
        </div>

        {/* Recipes Section */}
        <div className={styles.recipesSection}>
          <div className={styles.sectionTitleRow}>
            <h3>🍳 {displayName.split(' ')[0]}'s Saved Recipes</h3>
            <span className={styles.countBadge}>{recipes.length} RECIPES</span>
          </div>

          <div className={styles.recipesGrid}>
            {loading ? (
              <div className={styles.loadingState}>
                <span className={styles.spinner} />
                <span>Loading saved recipes...</span>
              </div>
            ) : recipes.length === 0 ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>🍽️</span>
                <p>This chef hasn't saved any public recipes yet.</p>
              </div>
            ) : (
              recipes.map((r) => (
                <div key={r.id || r.title} className={styles.recipeCard}>
                  <div className={styles.recipeCardHeader}>
                    <span className={styles.recipeTag}>RECIPE</span>
                    {r.category && <span className={styles.categoryBadge}>{r.category}</span>}
                  </div>

                  <h4 className={styles.recipeTitle}>{r.title}</h4>

                  <div className={styles.recipeStats}>
                    {r.prepTime && <span>⏱️ {r.prepTime}</span>}
                    {r.difficulty && <span>🔥 {r.difficulty}</span>}
                    {r.servings && <span>👥 {r.servings} serv</span>}
                  </div>

                  <div className={styles.recipeCardActions}>
                    {onSelectRecipe && (
                      <button
                        className={styles.viewBtn}
                        onClick={() => {
                          onSelectRecipe(r);
                          onClose();
                        }}
                      >
                        📖 View Recipe
                      </button>
                    )}
                    {onSaveRecipe && (
                      <button
                        className={`${styles.saveBtn} ${savedRecipes.has(r.id) ? styles.savedBtn : ''}`}
                        onClick={() => handleSaveRecipeClick(r)}
                        disabled={savedRecipes.has(r.id)}
                      >
                        {savedRecipes.has(r.id) ? '✓ Saved' : '🍳 Save to Mine'}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
