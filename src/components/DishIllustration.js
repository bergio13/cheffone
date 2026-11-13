'use client';

import { UtensilsCrossed } from 'lucide-react';
import { resolveDishVisual } from '@/lib/dishVisual';
import styles from '@/app/page.module.css';

export { resolveDishVisual };

/**
 * Renders the Gemini image-model illustration generated strictly from the
 * recipe title, or a clean bistro placeholder while retroactive generation runs.
 */
export default function DishIllustration({ recipe }) {
  const { imageUrl } = resolveDishVisual(recipe);

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={recipe?.title ? `${recipe.title} illustration` : 'Dish illustration'}
        className={styles.bentoThumbImg}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <div className={styles.bentoMediaPlaceholder} aria-hidden="true">
      <UtensilsCrossed size={28} strokeWidth={2.2} />
    </div>
  );
}
