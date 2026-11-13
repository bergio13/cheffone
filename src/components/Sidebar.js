'use client';

import { ChevronLeft, ChevronRight, Clock, X, UtensilsCrossed } from 'lucide-react';
import styles from '@/app/page.module.css';
import DishIllustration, { resolveDishVisual } from './DishIllustration';

export default function Sidebar({
  recipes,
  activeRecipeId,
  open,
  onToggle,
  onSelect,
  onDelete,
  onExpandAndSelect,
  onExpand,
  collapsedClass,
}) {
  return (
    <aside className={`${styles.sidebar} ${!open ? styles.sidebarCollapsed : ''} ${collapsedClass || ''}`}>
      <div className={styles.sidebarHeader}>
        {open && <h3 className={styles.sidebarTitle}>Order Board</h3>}
        {open && <span className={styles.recipeCountBadge}>{recipes.length} ITEMS</span>}
        <button
          type="button"
          className={styles.sidebarToggle}
          onClick={onToggle}
          aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
          title={open ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {open ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>

      <div className={styles.recipeList}>
        {recipes.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}><UtensilsCrossed size={40} /></span>
            <p>Your order board is empty.</p>
            <p className={styles.emptyTextSub}>Scan a video link to order your first recipe!</p>
          </div>
        ) : (
          recipes.map((r, idx) => {
            const isFeatured = idx % 2 === 0;
            const visual = resolveDishVisual(r);

            return (
              <div
                key={r.id}
                role="button"
                tabIndex={0}
                className={`${styles.recipeCardItem} ${
                  isFeatured ? styles.recipeCardFeatured : styles.recipeCardCompact
                } ${activeRecipeId === r.id ? styles.recipeCardActive : ''}`}
                onClick={() => onSelect(r)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(r);
                  }
                }}
              >
                {isFeatured && (
                  <div
                    className={styles.bentoMedia}
                    style={{ backgroundColor: visual.backdrop }}
                  >
                    <DishIllustration recipe={r} />
                  </div>
                )}

                <div className={styles.recipeCardBody}>
                  <div className={styles.recipeCardTop}>
                    <span className={styles.recipeCardTitle}>{r.title}</span>
                    <div className={styles.recipeCardActions}>
                      <button
                        type="button"
                        className={styles.deleteButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(r.id);
                        }}
                        aria-label={`Delete ${r.title}`}
                        title="Delete recipe"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                  <div className={styles.recipeCardMeta}>
                    <span className={styles.metaInline}><Clock size={12} /> {r.prepTime || 'N/A'}</span>
                    <span className={styles.metaDivider}>•</span>
                    <span className={styles.metaCategory}>{r.category || 'Recipe'}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {!open && recipes.length > 0 && (
        <div className={styles.collapsedDots}>
          {recipes.slice(0, 6).map((r) => (
            <div
              key={r.id}
              className={`${styles.collapsedDot} ${activeRecipeId === r.id ? styles.collapsedDotActive : ''}`}
              onClick={() => onExpandAndSelect(r)}
              title={r.title}
            />
          ))}
          {recipes.length > 6 && (
            <div className={styles.collapsedMore} onClick={onExpand} title="Show all recipes">
              +{recipes.length - 6}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
