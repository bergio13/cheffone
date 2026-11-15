'use client';

import { useState } from 'react';
import {
  ArrowLeft,
  Clock,
  Flame,
  Gauge,
  Minus,
  Plus,
  Share2,
  BookmarkPlus,
  Play,
  Utensils,
  Apple,
  ChefHat,
  ChevronDown,
  Check,
  ExternalLink,
} from 'lucide-react';
import styles from '@/app/page.module.css';
import NutritionPanel from './NutritionPanel';
import DishIllustration, { resolveDishVisual } from './DishIllustration';
import {
  formatCompactDuration,
  formatIngredientUnit,
  formatScaledQuantity,
} from '@/lib/recipeFormat';

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
  setPlayVideoId,
  onBack,
  onSaveShared,
  onShare,
}) {
  const [isVideoExpanded, setIsVideoExpanded] = useState(false);
  const [isIngredientsOpen, setIsIngredientsOpen] = useState(true);
  const [isDirectionsOpen, setIsDirectionsOpen] = useState(true);
  const [activeStep, setActiveStep] = useState(0);

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
  const dishVisual = resolveDishVisual(recipe);
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const instructions = Array.isArray(recipe.instructions) ? recipe.instructions : [];
  const checkedCount = ingredients.reduce((acc, _, idx) => acc + (checkedIngredients[idx] ? 1 : 0), 0);

  const hasEmbeddableVideo = Boolean(recipe.videoUrl || recipe.iframeHtml);
  const safeSourceUrl =
    typeof recipe.sourceUrl === 'string' && /^https?:\/\//i.test(recipe.sourceUrl.trim())
      ? recipe.sourceUrl.trim()
      : '';
  const hasAnyVideoSource = hasEmbeddableVideo || Boolean(safeSourceUrl);
  const videoTitle = hasEmbeddableVideo
    ? 'Watch Recipe Video'
    : safeSourceUrl
      ? 'Original Recipe Video'
      : 'No Video Available';
  const videoSubtitle = hasEmbeddableVideo
    ? `${recipe.videoDuration ? `${recipe.videoDuration} • ` : ''}Tap to expand player`
    : safeSourceUrl
      ? 'Tap to open source link'
      : 'Parsed from text caption';

  const handleToggleVideo = () => {
    if (!hasAnyVideoSource) return;
    setIsVideoExpanded((prev) => {
      const next = !prev;
      if (next && recipe.iframeHtml && setPlayVideoId) {
        setPlayVideoId(recipe.id);
      }
      return next;
    });
  };

  return (
    <div className={styles.recipeDetail}>
      <div className={styles.detailActionBar}>
        <button
          type="button"
          className={`${styles.actionBoardBtn} ${previewFromFriend ? styles.actionBoardBtnAlways : ''}`}
          onClick={onBack}
          title={previewFromFriend ? `Back to ${friendName}'s profile` : 'Back to board'}
        >
          <ArrowLeft size={15} />
          <span>{previewFromFriend ? `${friendName}'s Profile` : 'Board'}</span>
        </button>

        {recipe.isPreviewOnly && !isSaved ? (
          <button
            type="button"
            className={styles.actionSaveBtn}
            onClick={onSaveShared}
            title="Save this shared recipe to your collection"
          >
            <BookmarkPlus size={15} />
            <span>Save</span>
          </button>
        ) : (
          <button
            type="button"
            className={styles.actionShareBtn}
            onClick={onShare}
            title="Share recipe with friends"
          >
            <Share2 size={15} />
            <span>Share</span>
          </button>
        )}
      </div>

      <div className={styles.recipeHeroRow}>
        <div className={styles.titleArea}>
          <span className={styles.categoryBadge}>{recipe.category || 'Recipe'}</span>
          <h2 className={styles.recipeTitle}>{recipe.title}</h2>
        </div>

        <div
          className={styles.recipeHeroThumb}
          style={{ backgroundColor: dishVisual.backdrop }}
        >
          <DishIllustration recipe={recipe} />
        </div>
      </div>

      <div className={styles.metadataStrip}>
        <div className={styles.metaStripItem}>
          <span className={styles.metaStripTop}>
            <Clock size={13} className={styles.metaStripIcon} />
            <span className={styles.metaLabel}>PREP</span>
          </span>
          <span className={styles.metaValue}>{formatCompactDuration(recipe.prepTime)}</span>
        </div>
        <div className={styles.metaStripItem}>
          <span className={styles.metaStripTop}>
            <Flame size={13} className={styles.metaStripIcon} />
            <span className={styles.metaLabel}>COOK</span>
          </span>
          <span className={styles.metaValue}>{formatCompactDuration(recipe.cookTime)}</span>
        </div>
        <div className={styles.metaStripItem}>
          <span className={styles.metaStripTop}>
            <Gauge size={13} className={styles.metaStripIcon} />
            <span className={styles.metaLabel}>LEVEL</span>
          </span>
          <span className={styles.metaValue}>{recipe.difficulty || 'Easy'}</span>
        </div>
      </div>

      <div className={styles.tabsContainer}>
        <div className={styles.tabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'recipe'}
            className={`${styles.tab} ${activeTab === 'recipe' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('recipe')}
          >
            <Utensils size={15} />
            <span>Recipe &amp; Video</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'nutrition'}
            className={`${styles.tab} ${activeTab === 'nutrition' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('nutrition')}
          >
            <Apple size={15} />
            <span>Nutrition Facts</span>
          </button>
        </div>
      </div>

      <div className={styles.tabContent}>
        {activeTab === 'recipe' && (
          <div className={styles.recipeStack}>
            <div className={styles.videoCollapsibleCard}>
              <div className={styles.videoPreviewHeader}>
                <button
                  type="button"
                  className={styles.videoPreviewBar}
                  onClick={handleToggleVideo}
                  aria-expanded={hasAnyVideoSource ? isVideoExpanded : undefined}
                  disabled={!hasAnyVideoSource}
                >
                  <div className={styles.videoThumbBox} aria-hidden="true">
                    <Play size={17} fill="currentColor" />
                  </div>
                  <div className={styles.videoBarText}>
                    <span className={styles.videoBarTitle}>{videoTitle}</span>
                    <span className={styles.videoBarSub}>{videoSubtitle}</span>
                  </div>
                  {hasAnyVideoSource && (
                    <span
                      className={`${styles.videoChevronBtn} ${isVideoExpanded ? styles.chevronRotated : ''}`}
                      aria-hidden="true"
                    >
                      <ChevronDown size={16} />
                    </span>
                  )}
                </button>

                {safeSourceUrl && (
                  <a
                    href={safeSourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.videoHeaderLinkBtn}
                    aria-label="Open original video link"
                    title="Open original video"
                  >
                    <ExternalLink size={15} />
                  </a>
                )}
              </div>

              {hasAnyVideoSource && (
                <div
                  className={`${styles.collapseBody} ${isVideoExpanded ? styles.collapseBodyOpen : ''}`}
                  aria-hidden={!isVideoExpanded}
                >
                  <div className={styles.collapseInner}>
                    <div className={styles.videoExpandedBody}>
                      {recipe.videoUrl ? (
                        <div className={styles.videoPlayerWrapper}>
                          <video
                            src={recipe.videoUrl}
                            controls
                            playsInline
                            className={styles.videoElement}
                            preload="metadata"
                          />
                        </div>
                      ) : recipe.iframeHtml && isVideoExpanded ? (
                        <div
                          className={styles.iframeContainer}
                          dangerouslySetInnerHTML={{ __html: recipe.iframeHtml }}
                        />
                      ) : null}

                      {safeSourceUrl && (
                        <a
                          href={safeSourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.sourceVideoBtn}
                        >
                          <ExternalLink size={15} />
                          <span>Open Original Video</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <section className={styles.accordionCard} aria-label="Ingredients">
              <div className={styles.accordionHeader}>
                <button
                  type="button"
                  className={styles.accordionToggleBtn}
                  onClick={() => setIsIngredientsOpen((prev) => !prev)}
                  aria-expanded={isIngredientsOpen}
                >
                  <ChevronDown
                    size={18}
                    className={`${styles.accordionChevron} ${isIngredientsOpen ? '' : styles.accordionChevronCollapsed}`}
                  />
                  <span className={styles.accordionTitle}>Ingredients</span>
                  <span
                    className={`${styles.progressPill} ${checkedCount > 0 ? styles.progressPillActive : ''}`}
                  >
                    {checkedCount}/{ingredients.length}
                  </span>
                </button>

                <div className={styles.servingsStepper} aria-label="Adjust servings">
                  <button
                    type="button"
                    className={styles.stepperBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      setAdjustedServings(Math.max(1, adjustedServings - 1));
                    }}
                    aria-label="Fewer servings"
                  >
                    <Minus size={14} />
                  </button>
                  <span className={styles.stepperCount} aria-live="polite">
                    {adjustedServings}
                  </span>
                  <button
                    type="button"
                    className={styles.stepperBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      setAdjustedServings(adjustedServings + 1);
                    }}
                    aria-label="More servings"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              <div
                className={`${styles.collapseBody} ${isIngredientsOpen ? styles.collapseBodyOpen : ''}`}
                aria-hidden={!isIngredientsOpen}
              >
                <div className={styles.collapseInner}>
                  <div className={styles.ingredientsList}>
                    {ingredients.map((ing, idx) => {
                      const scaledQty = formatScaledQuantity(ing.quantity, recipe.servings, adjustedServings);
                      const cleanUnit = formatIngredientUnit(ing.unit);
                      const qtyWithUnit = [scaledQty, cleanUnit].filter(Boolean).join(' ');
                      const checked = !!checkedIngredients[idx];

                      return (
                        <label
                          key={idx}
                          className={`${styles.ingredientRow} ${checked ? styles.ingredientRowChecked : ''}`}
                        >
                          <input
                            type="checkbox"
                            className={styles.srCheckbox}
                            checked={checked}
                            onChange={() => onToggleIngredient(idx)}
                          />
                          <span className={`${styles.customBox} ${checked ? styles.customBoxChecked : ''}`} aria-hidden="true">
                            {checked && <Check size={13} strokeWidth={3} />}
                          </span>
                          <span className={styles.ingredientText}>
                            {qtyWithUnit && (
                              <>
                                <strong className={styles.quantityHighlight}>{qtyWithUnit}</strong>{' '}
                              </>
                            )}
                            {ing.name}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            <section className={styles.accordionCard} aria-label="Cooking Directions">
              <div className={styles.accordionHeader}>
                <button
                  type="button"
                  className={styles.accordionToggleBtn}
                  onClick={() => setIsDirectionsOpen((prev) => !prev)}
                  aria-expanded={isDirectionsOpen}
                >
                  <ChevronDown
                    size={18}
                    className={`${styles.accordionChevron} ${isDirectionsOpen ? '' : styles.accordionChevronCollapsed}`}
                  />
                  <span className={styles.accordionTitle}>Cooking Directions</span>
                  <span className={styles.stepStatusPill}>
                    {instructions.length > 0 ? `Step ${activeStep + 1} of ${instructions.length}` : '0 steps'}
                  </span>
                </button>
              </div>

              <div
                className={`${styles.collapseBody} ${isDirectionsOpen ? styles.collapseBodyOpen : ''}`}
                aria-hidden={!isDirectionsOpen}
              >
                <div className={styles.collapseInner}>
                  <div className={styles.directionsList}>
                    {instructions.map((step, idx) => {
                      const isActive = idx === activeStep;
                      return (
                        <button
                          key={idx}
                          type="button"
                          className={`${styles.directionRow} ${isActive ? styles.directionRowActive : ''}`}
                          onClick={() => setActiveStep(idx)}
                          aria-current={isActive ? 'step' : undefined}
                        >
                          <span className={`${styles.stepCircle} ${isActive ? styles.stepCircleActive : ''}`}>
                            {idx + 1}
                          </span>
                          <span className={styles.directionText}>{step}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'nutrition' && (
          <NutritionPanel
            nutrition={recipe.nutrition}
            servings={recipe.servings}
            adjustedServings={adjustedServings}
          />
        )}
      </div>
    </div>
  );
}
