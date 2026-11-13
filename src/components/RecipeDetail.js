'use client';

import {
  ArrowLeft,
  Clock,
  Flame,
  Gauge,
  Film,
  Minus,
  Plus,
  Share2,
  BookmarkPlus,
  Play,
  Utensils,
  Apple,
  ChefHat,
} from 'lucide-react';
import styles from '@/app/page.module.css';
import NutritionPanel from './NutritionPanel';

export default function RecipeDetail({
  recipe,
  isSaved,
  previewFromFriend,
  adjustedServings,
  setAdjustedServings,
  checkedIngredients,
  onToggleIngredient,
  activeTab,
  setActiveTab,
  playVideoId,
  setPlayVideoId,
  onBack,
  onSaveShared,
  onShare,
}) {
  const scaleQuantity = (quantity, originalServings) => {
    if (quantity === null || quantity === undefined) return '';
    const ratio = adjustedServings / (originalServings || 2);
    return Math.round(quantity * ratio * 100) / 100;
  };

  if (!recipe) {
    return (
      <div className={styles.emptyDetailState}>
        <span className={styles.emptyStateIcon}><ChefHat size={64} /></span>
        <h3>Your Kitchen Awaits</h3>
        <p>Select a recipe from the Order Board, or paste a TikTok / Instagram video link to scan a new one.</p>
      </div>
    );
  }

  const friendName = previewFromFriend?.displayName?.split(' ')[0] || 'Chef';

  return (
    <div className={styles.recipeDetail}>
      <div className={styles.recipeHeaderBlock}>
        <button
          className={previewFromFriend ? styles.backToProfileBtnDesktop : styles.mobileBackBtn}
          onClick={onBack}
          title={previewFromFriend ? 'Back to friend profile' : 'Back to board'}
        >
          <ArrowLeft size={16} />
          {previewFromFriend ? `Back to ${friendName}'s Profile` : 'Back to Board'}
        </button>
        <div className={styles.titleArea}>
          <div className={styles.titleBadgeContainer}>
            <span className={styles.categoryBadge}>{recipe.category || 'Recipe'}</span>
            {recipe.difficulty && (
              <span className={`${styles.categoryBadge} ${styles.difficultyBadge}`}>{recipe.difficulty}</span>
            )}
          </div>
          <h2 className={styles.recipeTitle}>{recipe.title}</h2>
        </div>

        <div className={styles.headerControls}>
          <div className={styles.servingAdjuster}>
            <span className={styles.servingLabel}>SIZE:</span>
            <button
              className={styles.adjustBtn}
              onClick={() => setAdjustedServings(Math.max(1, adjustedServings - 1))}
              aria-label="Fewer servings"
            >
              <Minus size={16} />
            </button>
            <span className={styles.servingCount} aria-live="polite">{adjustedServings}</span>
            <button
              className={styles.adjustBtn}
              onClick={() => setAdjustedServings(adjustedServings + 1)}
              aria-label="More servings"
            >
              <Plus size={16} />
            </button>
          </div>
          {recipe.isPreviewOnly && !isSaved ? (
            <button
              className={styles.savePreviewBtn}
              onClick={onSaveShared}
              title="Save this shared recipe to your collection"
            >
              <BookmarkPlus size={16} /> Save to My Collection
            </button>
          ) : (
            <button className={styles.detailShareBtn} onClick={onShare} title="Share recipe with friends">
              <Share2 size={16} /> Share with Friends
            </button>
          )}
        </div>
      </div>

      <div className={styles.metadataGrid}>
        <div className={styles.metaItem}>
          <span className={styles.metaIcon}><Clock size={20} /></span>
          <div className={styles.metaText}>
            <span className={styles.metaLabel}>Prep Time</span>
            <span className={styles.metaValue}>{recipe.prepTime || 'N/A'}</span>
          </div>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaIcon}><Flame size={20} /></span>
          <div className={styles.metaText}>
            <span className={styles.metaLabel}>Cook Time</span>
            <span className={styles.metaValue}>{recipe.cookTime || 'N/A'}</span>
          </div>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaIcon}><Gauge size={20} /></span>
          <div className={styles.metaText}>
            <span className={styles.metaLabel}>Difficulty</span>
            <span className={styles.metaValue}>{recipe.difficulty || 'Easy'}</span>
          </div>
        </div>
        {recipe.sourceUrl && (
          <div className={styles.metaItem}>
            <span className={styles.metaIcon}><Film size={20} /></span>
            <div className={styles.metaText}>
              <span className={styles.metaLabel}>Source</span>
              <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer" className={styles.metaLink}>
                View Video
              </a>
            </div>
          </div>
        )}
      </div>

      <div className={styles.tabsContainer}>
        <div className={styles.tabs} role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'recipe'}
            className={`${styles.tab} ${activeTab === 'recipe' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('recipe')}
          >
            <Utensils size={16} /> Recipe &amp; Video
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'nutrition'}
            className={`${styles.tab} ${activeTab === 'nutrition' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('nutrition')}
          >
            <Apple size={16} /> Nutrition Facts
          </button>
        </div>
      </div>

      <div className={styles.tabContent}>
        {activeTab === 'recipe' && (
          <div className={styles.culinaryGrid}>
            <div className={styles.leftMediaColumn}>
              {recipe.iframeHtml ? (
                playVideoId === recipe.id ? (
                  <div className={styles.videoCard}>
                    <div className={styles.videoCardTab}>TIKTOK PREVIEW</div>
                    <div className={styles.iframeContainer} dangerouslySetInnerHTML={{ __html: recipe.iframeHtml }} />
                  </div>
                ) : (
                  <div
                    className={styles.videoFacade}
                    role="button"
                    tabIndex={0}
                    onClick={() => setPlayVideoId(recipe.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') setPlayVideoId(recipe.id);
                    }}
                    title="Tap to load video preview"
                  >
                    <span className={styles.videoFacadeBadge}>TIKTOK FEED</span>
                    <div className={styles.videoFacadePlayBtn}>
                      <Play size={28} className={styles.playIcon} />
                    </div>
                    <span className={styles.videoFacadeText}>Load Video Feed</span>
                    <span className={styles.videoFacadeSub}>Tapping pulls tracking scripts and video media</span>
                  </div>
                )
              ) : recipe.videoUrl ? (
                <div className={styles.videoCard}>
                  <div className={styles.videoCardTab}>NOW PLAYING</div>
                  <div className={styles.videoPlayerWrapper}>
                    <video
                      src={recipe.videoUrl}
                      controls
                      playsInline
                      className={styles.videoElement}
                      preload="metadata"
                    />
                  </div>
                </div>
              ) : (
                <div className={styles.videoCardPlaceholder}>
                  <span className={styles.placeholderIcon}><Film size={40} /></span>
                  <p className={styles.placeholderTitle}>No Video Feed</p>
                  <span className={styles.placeholderSub}>
                    Add your RAPIDAPI_KEY to download and watch the recipe video right inside the app!
                  </span>
                </div>
              )}
            </div>

            <div className={styles.rightContentColumn}>
              <div className={styles.ingredientsCard}>
                <h4 className={styles.sectionHeading}>Ingredients Checklist</h4>
                <p className={styles.sectionSubtitle}>Scale sizes above. Check items as you toss them in.</p>
                <div className={styles.ingredientsList}>
                  {recipe.ingredients?.map((ing, idx) => (
                    <label
                      key={idx}
                      className={`${styles.ingredientItem} ${checkedIngredients[idx] ? styles.ingredientChecked : ''}`}
                    >
                      <div className={styles.checkboxWrapper}>
                        <input
                          type="checkbox"
                          className={styles.checkbox}
                          checked={!!checkedIngredients[idx]}
                          onChange={() => onToggleIngredient(idx)}
                        />
                        <span className={styles.customCheckbox}></span>
                      </div>
                      <span className={styles.ingredientText}>
                        <strong className={styles.quantityHighlight}>
                          {scaleQuantity(ing.quantity, recipe.servings)} {ing.unit}
                        </strong>{' '}
                        {ing.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className={styles.instructionsCard}>
                <h4 className={styles.sectionHeading}>Cooking Directions</h4>
                <div className={styles.instructionsList}>
                  {recipe.instructions?.map((step, idx) => (
                    <div key={idx} className={styles.stepCard}>
                      <div className={styles.stepIndicator}>
                        <div className={styles.stepNumber}>{idx + 1}</div>
                        {idx < recipe.instructions.length - 1 && <div className={styles.stepConnector}></div>}
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

        {activeTab === 'nutrition' && <NutritionPanel nutrition={recipe.nutrition} />}
      </div>
    </div>
  );
}
