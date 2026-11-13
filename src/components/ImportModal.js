'use client';

import { X, Link2, FileText, Zap, Music2, Camera, TriangleAlert, Loader2 } from 'lucide-react';
import styles from '@/app/page.module.css';

export default function ImportModal({
  onClose,
  scanTab,
  setScanTab,
  url,
  setUrl,
  rawText,
  setRawText,
  loading,
  error,
  onSubmit,
}) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.modalContent}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button className={styles.modalClose} onClick={onClose} aria-label="Close window">
          <X size={18} />
        </button>

        <div className={styles.parseHeader}>
          <div className={styles.stickerBadge}>
            <Zap size={14} /> CHEFFONE AI SCANNER
          </div>
          <h2 id="import-title" className={styles.parseTitle}>Scan &amp; Extract Recipe</h2>
          <div className={styles.platformPills}>
            <span className={styles.platformPill}><Music2 size={14} /> TikTok</span>
            <span className={styles.platformPill}><Camera size={14} /> Instagram Reels</span>
          </div>
        </div>

        <div className={styles.scanModeTabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={scanTab === 'link'}
            className={`${styles.scanTab} ${scanTab === 'link' ? styles.scanTabActive : ''}`}
            onClick={() => setScanTab('link')}
          >
            <Link2 size={16} /> Video URL Link
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={scanTab === 'text'}
            className={`${styles.scanTab} ${scanTab === 'text' ? styles.scanTabActive : ''}`}
            onClick={() => setScanTab('text')}
          >
            <FileText size={16} /> Caption / Raw Text
          </button>
        </div>

        {scanTab === 'link' ? (
          <form onSubmit={onSubmit} className={styles.scanForm}>
            <div className={styles.urlInputContainer}>
              <span className={styles.inputLinkIcon}><Link2 size={18} /></span>
              <input
                type="url"
                className={styles.urlInput}
                placeholder="Paste video URL link here..."
                aria-label="Video URL"
                value={url}
                onChange={(e) => {
                  const val = e.target.value;
                  setUrl(val);
                  if (val.includes('instagram.com')) setScanTab('text');
                }}
              />
            </div>
            <button type="submit" className={styles.primaryButton} disabled={loading || !url.trim()}>
              {loading ? (
                <><Loader2 size={18} className={styles.spin} /> Grilling...</>
              ) : (
                <>Order Recipe <Zap size={18} /></>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={onSubmit} className={styles.scanForm}>
            <textarea
              className={styles.textarea}
              placeholder="Paste the video caption, ingredients list, or recipe notes here to parse..."
              aria-label="Caption or recipe text"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={4}
            />
            <button type="submit" className={styles.primaryButton} disabled={loading || !rawText.trim()}>
              {loading ? (
                <><Loader2 size={18} className={styles.spin} /> Grilling...</>
              ) : (
                <>Parse Text &amp; Order <Zap size={18} /></>
              )}
            </button>
          </form>
        )}

        {error && (
          <div className={styles.errorAlert} role="alert">
            <TriangleAlert size={16} /> {error}
          </div>
        )}
      </div>
    </div>
  );
}
