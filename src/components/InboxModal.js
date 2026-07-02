'use client';

import { useState, useEffect } from 'react';
import styles from './InboxModal.module.css';
import { getInbox, markInboxSeen, deleteInboxItem } from '@/lib/friends';

function Avatar({ src, name, size = 36 }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={styles.avatar}
        style={{ width: size, height: size }}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <div className={styles.avatarInitial} style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  );
}

export default function InboxModal({ currentUser, onClose, onSaveRecipe }) {
  const [inbox, setInbox] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(new Set());

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    getInbox(currentUser.uid).then((items) => {
      setInbox(items);
      setLoading(false);
      // Mark all as seen
      items.filter((i) => !i.seen).forEach((i) => markInboxSeen(currentUser.uid, i.id));
    });
  }, [currentUser]);

  const handleSave = async (item) => {
    if (saved.has(item.id)) return;
    await onSaveRecipe(item.recipe);
    setSaved((prev) => new Set([...prev, item.id]));
  };

  const handleDiscard = async (item) => {
    await deleteInboxItem(currentUser.uid, item.id);
    setInbox((prev) => prev.filter((i) => i.id !== item.id));
  };

  const formatDate = (ts) => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>

        <div className={styles.header}>
          <div className={styles.badge}>INCOMING ORDER</div>
          <h2 className={styles.title}>Recipe Inbox</h2>
          <p className={styles.subtitle}>Recipes shared by your friends.</p>
        </div>

        <div className={styles.list}>
          {loading ? (
            <div className={styles.emptyState}>
              <span className={styles.spinner} />
              Loading...
            </div>
          ) : inbox.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>📬</span>
              <p>Your inbox is empty.</p>
              <p className={styles.emptyHint}>Ask a friend to share a recipe with you!</p>
            </div>
          ) : (
            inbox.map((item) => (
              <div key={item.id} className={`${styles.inboxCard} ${!item.seen ? styles.unseen : ''}`}>
                {!item.seen && <span className={styles.newDot} />}
                <div className={styles.inboxHeader}>
                  <Avatar src={item.fromPhoto} name={item.fromName} size={32} />
                  <div className={styles.inboxMeta}>
                    <span className={styles.fromName}>{item.fromName}</span>
                    <span className={styles.sharedAt}>{formatDate(item.sharedAt)}</span>
                  </div>
                </div>

                <div className={styles.recipePreview}>
                  <div className={styles.recipeInfo}>
                    <span className={styles.recipeCategory}>{item.recipe.category || 'Recipe'}</span>
                    <span className={styles.recipeTitle}>{item.recipe.title}</span>
                    <div className={styles.recipeMeta}>
                      {item.recipe.prepTime && <span>⏱️ {item.recipe.prepTime}</span>}
                      {item.recipe.difficulty && <span>🔥 {item.recipe.difficulty}</span>}
                    </div>
                  </div>
                </div>

                <div className={styles.inboxActions}>
                  <button
                    className={`${styles.saveBtn} ${saved.has(item.id) ? styles.savedBtn : ''}`}
                    onClick={() => handleSave(item)}
                    disabled={saved.has(item.id)}
                  >
                    {saved.has(item.id) ? '✓ Saved!' : '🍳 Save to My Collection'}
                  </button>
                  <button className={styles.discardBtn} onClick={() => handleDiscard(item)}>
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
