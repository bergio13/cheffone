'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './PWAInstallPrompt.module.css';

export default function PWAInstallPrompt({ onRegisterPrompt }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [installed, setInstalled] = useState(false);

  // 1. Service Worker Registration & Standalone / iOS Detection
  useEffect(() => {
    // Check if running as standalone PWA
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();

    // Check iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // Check localStorage dismissal
    const dismissed = localStorage.getItem('cheffone_pwa_dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      // Re-show after 3 days if dismissed
      if (Date.now() - dismissedTime < 3 * 24 * 60 * 60 * 1000) {
        setIsDismissed(true);
      }
    }

    // Register Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          // Check for worker updates
          reg.onupdatefound = () => {
            const installingWorker = reg.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('New content is available; will update automatically.');
                }
              };
            }
          };
        })
        .catch((err) => {
          console.warn('Service Worker registration failed:', err);
        });
    }

    // Capture beforeinstallprompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Custom event to trigger modal from header or other components
    const handleOpenInstallModal = () => {
      setShowModal(true);
    };
    window.addEventListener('open-cheffone-install-modal', handleOpenInstallModal);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('open-cheffone-install-modal', handleOpenInstallModal);
    };
  }, []);

  // Expose trigger callback to parent if provided
  const handleTriggerInstall = useCallback(() => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted Cheffone install prompt');
          setInstalled(true);
        }
        setDeferredPrompt(null);
      });
    } else {
      setShowModal(true);
    }
  }, [deferredPrompt]);

  useEffect(() => {
    if (onRegisterPrompt) {
      onRegisterPrompt({
        triggerInstall: handleTriggerInstall,
        isStandalone,
        isInstallable: !!deferredPrompt || isIOS,
      });
    }
  }, [onRegisterPrompt, handleTriggerInstall, deferredPrompt, isStandalone, isIOS]);

  return (
    <>
      {/* Detailed Install Guidance Modal */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button
              className={styles.modalClose}
              onClick={() => setShowModal(false)}
              title="Close modal"
            >
              ✕
            </button>

            <div className={styles.modalHeader}>
              <img src="/icon-192x192.png" alt="Cheffone" className={styles.modalAppIcon} />
              <h2 className={styles.modalTitle}>Download Cheffone</h2>
            </div>

            {/* Platform Instructions */}
            {isIOS ? (
              <div className={styles.stepsContainer}>
                <div className={styles.stepsTitle}>
                  <span>🍎</span> Easy 2-Step iOS Installation
                </div>
                <div className={styles.stepItem}>
                  <div className={styles.stepNumber}>1</div>
                  <div className={styles.stepContent}>
                    Tap the <strong>Share</strong> button in Safari's bottom toolbar{' '}
                    <span className={styles.stepIconHighlight}>⎋</span>.
                  </div>
                </div>
                <div className={styles.stepItem}>
                  <div className={styles.stepNumber}>2</div>
                  <div className={styles.stepContent}>
                    Scroll down and tap{' '}
                    <span className={styles.stepIconHighlight}>➕ Add to Home Screen</span>, then tap <strong>Add</strong> in the top-right corner.
                  </div>
                </div>
              </div>
            ) : deferredPrompt ? (
              <div style={{ marginBottom: '1.5rem' }}>
                <button
                  className={styles.modalPrimaryBtn}
                  onClick={() => {
                    setShowModal(false);
                    deferredPrompt.prompt();
                    deferredPrompt.userChoice.then((choiceResult) => {
                      if (choiceResult.outcome === 'accepted') {
                        setInstalled(true);
                      }
                      setDeferredPrompt(null);
                    });
                  }}
                >
                  📲 Install Cheffone Now
                </button>
              </div>
            ) : (
              <div className={styles.stepsContainer}>
                <div className={styles.stepsTitle}>
                  <span>💻</span> Desktop / Browser Installation
                </div>
                <div className={styles.stepItem}>
                  <div className={styles.stepNumber}>1</div>
                  <div className={styles.stepContent}>
                    Click the <strong>Install icon</strong> in your browser&apos;s address bar (or menu <span className={styles.stepIconHighlight}>⋮</span> &rarr; <strong>Install Cheffone</strong>).
                  </div>
                </div>
                <div className={styles.stepItem}>
                  <div className={styles.stepNumber}>2</div>
                  <div className={styles.stepContent}>
                    Confirm to add Cheffone to your Desktop, Dock, or Applications menu!
                  </div>
                </div>
              </div>
            )}

            <button
              className={styles.modalPrimaryBtn}
              onClick={() => {
                if (deferredPrompt) {
                  deferredPrompt.prompt();
                  deferredPrompt.userChoice.then((res) => {
                    if (res.outcome === 'accepted') setInstalled(true);
                    setDeferredPrompt(null);
                  });
                }
                setShowModal(false);
              }}
            >
              {deferredPrompt ? '📲 Continue Installation' : 'Got it, thanks!'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// Exportable trigger helper to open the install modal from anywhere
export function triggerInstallModal() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('open-cheffone-install-modal'));
  }
}
