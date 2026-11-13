'use client';

import { Check, TriangleAlert } from 'lucide-react';
import styles from '@/app/page.module.css';

export default function NutritionPanel({ nutrition }) {
  const n = nutrition || {};
  const cards = [
    { key: 'calories', label: 'Calories', cls: styles.calCard, color: 'var(--accent-primary)', always: true },
    { key: 'protein', label: 'Protein', cls: styles.protCard, color: 'var(--success)', always: true },
    { key: 'carbs', label: 'Carbs', cls: styles.carbCard, color: 'var(--accent-yellow)', always: true },
    { key: 'fat', label: 'Fat', cls: styles.fatCard, color: 'var(--text-primary)', always: true },
    { key: 'fiber', label: 'Fiber', cls: styles.fibCard, color: '#7c3aed' },
    { key: 'sodium', label: 'Sodium', cls: styles.fatCard, color: '#f59e0b' },
    { key: 'sugar', label: 'Sugar', cls: styles.calCard, color: '#ec4899' },
  ];

  return (
    <div className={styles.nutritionContainer}>
      {n.healthScore && (
        <div className={styles.healthBanner}>
          <div className={styles.healthScoreWrap}>
            <span className={styles.healthScoreNum}>
              {n.healthScore}
              <span className={styles.healthScoreOf}>/10</span>
            </span>
            <span className={styles.healthLabel}>{n.healthLabel || 'Health Score'}</span>
          </div>
          <div className={styles.healthScoreBar}>
            <div className={styles.healthScoreFill} style={{ width: `${(n.healthScore / 10) * 100}%` }} />
          </div>
          {n.healthSummary && <p className={styles.healthSummary}>{n.healthSummary}</p>}
        </div>
      )}

      {(n.benefits?.length > 0 || n.warnings?.length > 0) && (
        <div className={styles.healthChipsRow}>
          {n.benefits?.map((b, i) => (
            <span key={i} className={styles.benefitChip}><Check size={13} /> {b}</span>
          ))}
          {n.warnings?.map((w, i) => (
            <span key={i} className={styles.warningChip}><TriangleAlert size={13} /> {w}</span>
          ))}
        </div>
      )}

      <div className={styles.nutritionHeader}>
        <h4 className={styles.sectionHeading}>Nutrition Facts</h4>
        <p className={styles.sectionSubtitle}>Estimated values per single serving size.</p>
      </div>

      <div className={styles.nutritionGrid}>
        {cards
          .filter((c) => c.always || n[c.key])
          .map((c) => (
            <div key={c.key} className={`${styles.nutritionCard} ${c.cls}`}>
              <span className={styles.nutritionVal}>{n[c.key] || '—'}</span>
              <span className={styles.nutritionLabel}>{c.label}</span>
              <div className={styles.macroIndicator} style={{ background: c.color }} />
            </div>
          ))}
      </div>

      <div className={styles.nutritionDisclaimer}>
        <span className={styles.disclaimerIcon}><TriangleAlert size={16} /></span>
        <span>
          Macros and health analysis are estimated by Gemini AI. For precise medical dietary guidance,
          consult a professional.
        </span>
      </div>
    </div>
  );
}
