'use client';

import { useState, useEffect } from 'react';
import styles from './FriendsModal.module.css';
import {
  searchUserByEmail,
  sendFriendRequest,
  getPendingRequests,
  acceptFriendRequest,
  declineFriendRequest,
  getFriends,
  shareRecipeWithFriend,
} from '@/lib/friends';

function Avatar({ user, size = 36 }) {
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

export default function FriendsModal({ currentUser, onClose, recipeToShare, onShared }) {
  const isShareMode = !!recipeToShare;
  const [tab, setTab] = useState(isShareMode ? 'friends' : 'friends');
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searchStatus, setSearchStatus] = useState(''); // 'loading' | 'found' | 'not_found' | 'error'
  const [searchMsg, setSearchMsg] = useState('');
  const [sharedTo, setSharedTo] = useState(new Set()); // track who we've shared with this session
  const [busy, setBusy] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    setLoadingFriends(true);
    Promise.all([
      getFriends(currentUser.uid),
      getPendingRequests(currentUser.uid),
    ]).then(([f, r]) => {
      setFriends(f);
      setRequests(r);
      setLoadingFriends(false);
    });
  }, [currentUser]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchEmail.trim()) return;
    setSearchStatus('loading');
    setSearchResult(null);
    setSearchMsg('');
    try {
      const found = await searchUserByEmail(searchEmail);
      if (!found) {
        setSearchStatus('not_found');
        setSearchMsg('No user found with that email.');
      } else if (found.uid === currentUser.uid) {
        setSearchStatus('not_found');
        setSearchMsg("That's you! 😄");
      } else {
        setSearchResult(found);
        setSearchStatus('found');
      }
    } catch {
      setSearchStatus('error');
      setSearchMsg('Something went wrong. Try again.');
    }
  };

  const handleSendRequest = async (toUid) => {
    setBusy(true);
    try {
      await sendFriendRequest(currentUser, toUid);
      setSearchMsg('Friend request sent! 🎉');
      setSearchResult(null);
      setSearchStatus('sent');
    } catch (e) {
      setSearchMsg(e.message);
      setSearchStatus('error');
    } finally {
      setBusy(false);
    }
  };

  const handleAccept = async (req) => {
    setBusy(true);
    try {
      await acceptFriendRequest(req.id, req.fromUid, currentUser.uid);
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
      // Reload friends
      const updated = await getFriends(currentUser.uid);
      setFriends(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  const handleDecline = async (req) => {
    await declineFriendRequest(req.id);
    setRequests((prev) => prev.filter((r) => r.id !== req.id));
  };

  const handleShare = async (friend) => {
    if (!recipeToShare || sharedTo.has(friend.uid)) return;
    setBusy(true);
    try {
      await shareRecipeWithFriend(currentUser, friend.uid, recipeToShare);
      setSharedTo((prev) => new Set([...prev, friend.uid]));
      if (onShared) onShared(friend.displayName || friend.email);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.badge}>{isShareMode ? 'SHARE RECIPE' : 'SOCIAL KITCHEN'}</div>
          <h2 className={styles.title}>
            {isShareMode ? `Share "${recipeToShare.title}"` : 'Friends'}
          </h2>
          {isShareMode && (
            <p className={styles.subtitle}>Pick a friend to send this recipe to.</p>
          )}
        </div>

        {/* Tabs (only in management mode) */}
        {!isShareMode && (
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${tab === 'friends' ? styles.activeTab : ''}`}
              onClick={() => setTab('friends')}
            >
              👥 Friends {friends.length > 0 && <span className={styles.tabBadge}>{friends.length}</span>}
            </button>
            <button
              className={`${styles.tab} ${tab === 'requests' ? styles.activeTab : ''}`}
              onClick={() => setTab('requests')}
            >
              📬 Requests {requests.length > 0 && <span className={`${styles.tabBadge} ${styles.tabBadgeAlert}`}>{requests.length}</span>}
            </button>
            <button
              className={`${styles.tab} ${tab === 'add' ? styles.activeTab : ''}`}
              onClick={() => setTab('add')}
            >
              ➕ Add Friend
            </button>
          </div>
        )}

        {/* Content */}
        <div className={styles.content}>

          {/* Friends list */}
          {(tab === 'friends' || isShareMode) && (
            <div className={styles.list}>
              {loadingFriends ? (
                <div className={styles.emptyState}>
                  <span className={styles.spinner} />
                  Loading...
                </div>
              ) : friends.length === 0 ? (
                <div className={styles.emptyState}>
                  <span className={styles.emptyIcon}>👥</span>
                  <p>No friends yet.</p>
                  {!isShareMode && (
                    <button className={styles.addBtn} onClick={() => setTab('add')}>
                      Add your first friend
                    </button>
                  )}
                </div>
              ) : (
                friends.map((f) => (
                  <div key={f.uid} className={styles.friendCard}>
                    <Avatar user={f} />
                    <div className={styles.friendInfo}>
                      <span className={styles.friendName}>{f.displayName || 'Chef'}</span>
                      <span className={styles.friendEmail}>{f.email}</span>
                    </div>
                    {isShareMode && (
                      <button
                        className={`${styles.sendBtn} ${sharedTo.has(f.uid) ? styles.sentBtn : ''}`}
                        onClick={() => handleShare(f)}
                        disabled={busy || sharedTo.has(f.uid)}
                      >
                        {sharedTo.has(f.uid) ? '✓ Sent!' : '📤 Send'}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Pending requests */}
          {tab === 'requests' && !isShareMode && (
            <div className={styles.list}>
              {requests.length === 0 ? (
                <div className={styles.emptyState}>
                  <span className={styles.emptyIcon}>📬</span>
                  <p>No pending requests.</p>
                </div>
              ) : (
                requests.map((req) => (
                  <div key={req.id} className={styles.requestCard}>
                    <div className={styles.requestAvatar}>
                      {req.fromPhoto
                        ? <img src={req.fromPhoto} alt={req.fromName} className={styles.avatar} referrerPolicy="no-referrer" />
                        : <div className={styles.avatarInitial}>{(req.fromName || '?').charAt(0).toUpperCase()}</div>
                      }
                    </div>
                    <div className={styles.friendInfo}>
                      <span className={styles.friendName}>{req.fromName}</span>
                      <span className={styles.friendEmail}>{req.fromEmail}</span>
                    </div>
                    <div className={styles.requestActions}>
                      <button
                        className={styles.acceptBtn}
                        onClick={() => handleAccept(req)}
                        disabled={busy}
                      >
                        ✓
                      </button>
                      <button
                        className={styles.declineBtn}
                        onClick={() => handleDecline(req)}
                        disabled={busy}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Add Friend */}
          {tab === 'add' && !isShareMode && (
            <div className={styles.addSection}>
              <p className={styles.addHint}>Search by their Cheffone account email.</p>
              <form onSubmit={handleSearch} className={styles.searchForm}>
                <input
                  type="email"
                  className={styles.searchInput}
                  placeholder="friend@email.com"
                  value={searchEmail}
                  onChange={(e) => {
                    setSearchEmail(e.target.value);
                    setSearchResult(null);
                    setSearchStatus('');
                    setSearchMsg('');
                  }}
                  autoFocus
                />
                <button
                  type="submit"
                  className={styles.searchBtn}
                  disabled={searchStatus === 'loading'}
                >
                  {searchStatus === 'loading' ? '...' : '🔍'}
                </button>
              </form>

              {searchResult && (
                <div className={styles.searchResult}>
                  <Avatar user={searchResult} />
                  <div className={styles.friendInfo}>
                    <span className={styles.friendName}>{searchResult.displayName || 'Chef'}</span>
                    <span className={styles.friendEmail}>{searchResult.email}</span>
                  </div>
                  <button
                    className={styles.sendBtn}
                    onClick={() => handleSendRequest(searchResult.uid)}
                    disabled={busy}
                  >
                    Add Friend
                  </button>
                </div>
              )}

              {searchMsg && (
                <div className={`${styles.searchMsg} ${searchStatus === 'error' ? styles.searchMsgError : styles.searchMsgOk}`}>
                  {searchMsg}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
