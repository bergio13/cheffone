'use client';

import { useEffect, useRef } from 'react';
import { X, Link2, FileText, Zap, Music2, Camera, TriangleAlert, Loader2 } from 'lucide-react';
import styles from '@/app/page.module.css';

function detectPlatform(url) {
  const value = (url || '').toLowerCase();
  if (value.includes('tiktok.com')) return 'tiktok';
  if (value.includes('instagram.com') || value.includes('instagr.am')) return 'instagram';
  return null;
}

async function readClipboardOrFocus(onText, focusFallback) {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        onText(text.trim());
        return;
      }
    }
  } catch {
    // Clipboard permission denied or unsupported; fall back to focusing input.
  }
  focusFallback();
}

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
  const urlInputRef = useRef(null);
  const captionInputRef = useRef(null);
  const detectedPlatform = detectPlatform(url);
  const isSubmitDisabled = loading || (scanTab === 'link' ? !url.trim() : !rawText.trim());

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, loading]);

  return (
    <>
      <div
        className={styles.importBackdrop}
        onClick={() => !loading && onClose()}
        aria-hidden="true"
      />
      <div
        className={styles.importSheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.sheetDragHandle} aria-hidden="true" />

        <div className={styles.importHeaderRow}>
          <div className={styles.scannerPill}>
            <Zap size={13} strokeWidth={2.5} aria-hidden="true" />
            <span>CHEFFONE AI SCANNER</span>
          </div>
          <button
            type="button"
            className={styles.importCloseBtn}
            onClick={onClose}
            aria-label="Close"
            disabled={loading}
          >
            <X size={18} strokeWidth={2.5} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.importIntro}>
          <h2 id="import-title" className={styles.importTitle}>
            Scan &amp; Extract Recipe
          </h2>
          <div className={styles.platformSupportRow}>
            <span className={styles.platformHelperText}>
              Supports TikTok &amp; Instagram Reels links
            </span>
            {detectedPlatform === 'tiktok' && (
              <span className={`${styles.detectedBadge} ${styles.detectedTiktok}`}>
                <Music2 size={12} strokeWidth={2.5} aria-hidden="true" />
                <span>TikTok Detected</span>
              </span>
            )}
            {detectedPlatform === 'instagram' && (
              <span className={`${styles.detectedBadge} ${styles.detectedReel}`}>
                <Camera size={12} strokeWidth={2.5} aria-hidden="true" />
                <span>Reel Detected</span>
              </span>
            )}
          </div>
        </div>

        <div className={styles.scanModeTabs} role="tablist" aria-label="Import source">
          <button
            type="button"
            role="tab"
            aria-selected={scanTab === 'link'}
            className={`${styles.scanTab} ${scanTab === 'link' ? styles.scanTabActive : ''}`}
            onClick={() => setScanTab('link')}
          >
            <Link2 size={15} strokeWidth={2.3} aria-hidden="true" />
            <span>Video URL Link</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={scanTab === 'text'}
            className={`${styles.scanTab} ${scanTab === 'text' ? styles.scanTabActive : ''}`}
            onClick={() => setScanTab('text')}
          >
            <FileText size={15} strokeWidth={2.3} aria-hidden="true" />
            <span>Raw Caption</span>
          </button>
        </div>

        <form onSubmit={onSubmit} className={styles.scanForm}>
          {scanTab === 'link' ? (
            <div className={styles.urlInputBar}>
              <Link2 size={16} strokeWidth={2.2} className={styles.urlBarIcon} aria-hidden="true" />
              <input
                ref={urlInputRef}
                type="url"
                inputMode="url"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                className={styles.urlBarInput}
                placeholder="Paste video URL link here..."
                aria-label="Video URL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              {url ? (
                <button
                  type="button"
                  className={styles.clearInputBtn}
                  onClick={() => {
                    setUrl('');
                    urlInputRef.current?.focus();
                  }}
                  aria-label="Clear URL"
                >
                  <X size={13} strokeWidth={2.5} aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.pastePillBtn}
                  onClick={() => readClipboardOrFocus(setUrl, () => urlInputRef.current?.focus())}
                >
                  Paste
                </button>
              )}
            </div>
          ) : (
            <div className={styles.captionInputBox}>
              {rawText ? (
                <button
                  type="button"
                  className={`${styles.clearInputBtn} ${styles.captionTopAction}`}
                  onClick={() => {
                    setRawText('');
                    captionInputRef.current?.focus();
                  }}
                  aria-label="Clear caption"
                >
                  <X size={13} strokeWidth={2.5} aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  className={`${styles.pastePillBtn} ${styles.captionTopAction}`}
                  onClick={() =>
                    readClipboardOrFocus(setRawText, () => captionInputRef.current?.focus())
                  }
                >
                  Paste
                </button>
              )}
              <textarea
                ref={captionInputRef}
                className={styles.captionTextarea}
                placeholder="Paste recipe caption, ingredients, or video description here..."
                aria-label="Raw recipe caption"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={4}
              />
            </div>
          )}

          {error && (
            <div className={styles.importErrorAlert} role="alert">
              <TriangleAlert size={16} strokeWidth={2.3} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className={styles.extractPrimaryBtn} disabled={isSubmitDisabled}>
            {loading ? (
              <>
                <Loader2 size={18} strokeWidth={2.5} className={styles.spin} aria-hidden="true" />
                <span>Extracting Recipe...</span>
              </>
            ) : (
              <>
                <span>Extract Recipe</span>
                <Zap size={17} strokeWidth={2.5} aria-hidden="true" />
              </>
            )}
          </button>
        </form>
      </div>
    </>
  );
}
