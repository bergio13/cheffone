'use client';

import { useState, useEffect, useRef } from 'react';
import {
  X,
  MessageCircle,
  TriangleAlert,
  ArrowLeft,
  BookOpen,
  BookmarkPlus,
  Check,
  Clock,
  Flame,
  Users,
  Send,
  ChevronRight,
} from 'lucide-react';
import styles from './ChatModal.module.css';
import DishIllustration, { resolveDishVisual } from './DishIllustration';
import { formatCompactDuration } from '@/lib/recipeFormat';
import {
  getFriends,
  getChatId,
  sendChatMessage,
  subscribeToChatMessages,
  subscribeToUserChats,
  markChatAsRead,
} from '@/lib/friends';

function Avatar({ user, src, name, size = 38 }) {
  const photo = src || user?.photoURL;
  const displayName = name || user?.displayName || user?.email || '?';

  if (photo) {
    return (
      <img
        src={photo}
        alt={displayName}
        className={styles.avatar}
        style={{ width: size, height: size }}
        referrerPolicy="no-referrer"
      />
    );
  }
  const letter = displayName.charAt(0).toUpperCase();
  return (
    <div
      className={styles.avatarInitial}
      style={{ width: size, height: size, fontSize: size * 0.44 }}
      aria-hidden="true"
    >
      {letter}
    </div>
  );
}

export default function ChatModal({
  currentUser,
  onClose,
  initialFriend = null,
  onSelectRecipe,
  onSaveRecipe,
  onOpenProfile,
}) {
  const [friends, setFriends] = useState([]);
  const [userChats, setUserChats] = useState([]);
  const [activeFriend, setActiveFriend] = useState(initialFriend);
  const [mobileView, setMobileView] = useState(initialFriend ? 'chat' : 'list');
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [savedRecipes, setSavedRecipes] = useState(new Set());
  const [permissionError, setPermissionError] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Load friends list
  useEffect(() => {
    if (!currentUser) return;
    getFriends(currentUser.uid).then((fList) => {
      setFriends(fList);
      if (!initialFriend && fList.length > 0) {
        setActiveFriend((prev) => prev || fList[0]);
      }
    });
  }, [currentUser, initialFriend]);

  // Subscribe to user's chat conversations overview
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = subscribeToUserChats(
      currentUser.uid,
      (chats) => {
        setUserChats(chats);
        setPermissionError(false);
      },
      (err) => {
        if (err?.code === 'permission-denied' || err?.message?.includes('permission')) {
          setPermissionError(true);
        }
      }
    );
    return () => unsubscribe();
  }, [currentUser]);

  // Subscribe to active chat messages
  useEffect(() => {
    if (!currentUser || !activeFriend) {
      queueMicrotask(() => setMessages([]));
      return;
    }

    const chatId = getChatId(currentUser.uid, activeFriend.uid);
    markChatAsRead(chatId, currentUser.uid);

    const unsubscribe = subscribeToChatMessages(
      chatId,
      (msgs) => {
        setMessages(msgs);
        markChatAsRead(chatId, currentUser.uid);
        setPermissionError(false);
      },
      (err) => {
        if (err?.code === 'permission-denied' || err?.message?.includes('permission')) {
          setPermissionError(true);
        }
      }
    );

    return () => unsubscribe();
  }, [currentUser, activeFriend]);

  // Auto scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendText = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !activeFriend || sending) return;

    setSending(true);
    const textToSend = inputText.trim();
    setInputText('');

    try {
      await sendChatMessage(currentUser, activeFriend.uid, {
        type: 'text',
        text: textToSend,
      });
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleSaveRecipeClick = async (msgId, recipe) => {
    if (savedRecipes.has(msgId)) return;
    if (onSaveRecipe) {
      await onSaveRecipe(recipe);
      setSavedRecipes((prev) => new Set([...prev, msgId]));
    }
  };

  const formatTimestamp = (ts) => {
    if (!ts) return '';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Kitchen Chat"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.chatContainer}>
          {/* Sidebar Conversations / Friends */}
          <div
            className={`${styles.sidebar} ${
              mobileView === 'chat' ? styles.sidebarHiddenMobile : ''
            }`}
          >
            <div className={styles.sidebarHeader}>
              <div className={styles.sidebarTitleGroup}>
                <span className={styles.sidebarIconPill} aria-hidden="true">
                  <MessageCircle size={15} strokeWidth={2.5} />
                </span>
                <h3>Kitchen Chat</h3>
              </div>
              <button
                type="button"
                className={`${styles.closeBtn} ${styles.mobileOnlyClose}`}
                onClick={onClose}
                aria-label="Close chat"
                title="Close Chat"
              >
                <X size={18} strokeWidth={2.5} aria-hidden="true" />
              </button>
            </div>

            {permissionError && (
              <div className={styles.permissionWarning} role="alert">
                <TriangleAlert size={15} strokeWidth={2.3} aria-hidden="true" />
                <span>
                  Firestore Rules setup needed for chats collection. Check <code>firestore.rules</code>.
                </span>
              </div>
            )}

            <div className={styles.friendsList}>
              {friends.length === 0 ? (
                <div className={styles.emptySidebar}>
                  <p>No friends added yet.</p>
                  <p className={styles.subtext}>Add friends to start chatting!</p>
                </div>
              ) : (
                friends.map((friend) => {
                  const chatId = getChatId(currentUser.uid, friend.uid);
                  const chatData = userChats.find((c) => c.chatId === chatId);
                  const hasUnread = chatData?.unreadBy?.includes(currentUser.uid);
                  const isSelected = activeFriend?.uid === friend.uid;

                  return (
                    <button
                      type="button"
                      key={friend.uid}
                      className={`${styles.friendItem} ${
                        isSelected ? styles.friendItemActive : ''
                      }`}
                      onClick={() => {
                        setActiveFriend(friend);
                        setMobileView('chat');
                      }}
                    >
                      <div className={styles.avatarWrapper}>
                        <Avatar user={friend} size={40} />
                        {hasUnread && <span className={styles.unreadBadgeDot} />}
                      </div>

                      <div className={styles.friendMeta}>
                        <div className={styles.friendTopLine}>
                          <span className={styles.friendName}>
                            {friend.displayName || friend.email?.split('@')[0]}
                          </span>
                          {chatData?.lastMessageAt && (
                            <span className={styles.lastTime}>
                              {formatTimestamp(chatData.lastMessageAt)}
                            </span>
                          )}
                        </div>
                        <div className={styles.friendBottomLine}>
                          <span
                            className={`${styles.lastMessageSnippet} ${
                              hasUnread ? styles.unreadSnippet : ''
                            }`}
                          >
                            {chatData?.lastMessage || 'Start a conversation'}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Main Chat Area */}
          <div
            className={`${styles.mainChat} ${
              mobileView === 'list' ? styles.mainChatHiddenMobile : ''
            }`}
          >
            {activeFriend ? (
              <>
                {/* Chat Header */}
                <div className={styles.chatHeader}>
                  <div className={styles.chatHeaderLeft}>
                    <button
                      type="button"
                      className={styles.backBtnMobile}
                      onClick={() => setMobileView('list')}
                      aria-label="Back to friends"
                      title="Back to friends"
                    >
                      <ArrowLeft size={16} strokeWidth={2.5} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={styles.headerProfileClickable}
                      onClick={() => {
                        if (onOpenProfile) onOpenProfile(activeFriend);
                      }}
                      title="View chef profile & saved recipes"
                    >
                      <Avatar user={activeFriend} size={36} />
                      <div className={styles.headerTitleGroup}>
                        <h4>
                          {activeFriend.displayName ||
                            activeFriend.email?.split('@')[0] ||
                            'Chef'}
                        </h4>
                        <span className={styles.subBadge}>
                          <span>View Profile</span>
                          <ChevronRight size={12} strokeWidth={2.5} aria-hidden="true" />
                        </span>
                      </div>
                    </button>
                  </div>

                  <button
                    type="button"
                    className={styles.closeBtn}
                    onClick={onClose}
                    aria-label="Close chat"
                    title="Close Chat"
                  >
                    <X size={18} strokeWidth={2.5} aria-hidden="true" />
                  </button>
                </div>

                {/* Messages Stream */}
                <div className={styles.messagesList}>
                  {messages.length === 0 ? (
                    <div className={styles.emptyMessages}>
                      <span className={styles.emptyGlyph} aria-hidden="true">
                        <MessageCircle size={36} strokeWidth={2} />
                      </span>
                      <p>
                        Say hi to{' '}
                        <strong>
                          {activeFriend.displayName || 'your friend'}
                        </strong>
                        !
                      </p>
                      <p className={styles.subtext}>
                        Send messages or share recipes from your board.
                      </p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMe = msg.senderUid === currentUser.uid;
                      const isRecipeMsg = msg.type === 'recipe' && msg.recipe;
                      const visual = isRecipeMsg ? resolveDishVisual(msg.recipe) : null;
                      const isAlreadySaved = savedRecipes.has(msg.id);

                      return (
                        <div
                          key={msg.id}
                          className={`${styles.messageRow} ${
                            isMe ? styles.messageRowMe : styles.messageRowOther
                          }`}
                        >
                          {!isMe && (
                            <Avatar
                              src={msg.senderPhoto}
                              name={msg.senderName}
                              size={30}
                            />
                          )}

                          <div className={styles.messageBubbleContainer}>
                            {!isMe && (
                              <span className={styles.senderLabel}>
                                {msg.senderName}
                              </span>
                            )}

                            {isRecipeMsg ? (
                              <div className={styles.recipeCardBubble}>
                                <div className={styles.recipeBubbleTop}>
                                  <div
                                    className={styles.recipeBubbleThumb}
                                    style={{ backgroundColor: visual.backdrop }}
                                  >
                                    <DishIllustration recipe={msg.recipe} />
                                  </div>

                                  <div className={styles.recipeBubbleMeta}>
                                    <div className={styles.recipeBubbleHeader}>
                                      <span className={styles.recipeTag}>
                                        SHARED RECIPE
                                      </span>
                                      {msg.recipe.category && (
                                        <span className={styles.categoryBadge}>
                                          {msg.recipe.category}
                                        </span>
                                      )}
                                    </div>

                                    <h5 className={styles.recipeTitle}>
                                      {msg.recipe.title}
                                    </h5>

                                    <div className={styles.recipeStats}>
                                      {msg.recipe.prepTime && (
                                        <span className={styles.statItem}>
                                          <Clock size={12} strokeWidth={2.3} aria-hidden="true" />
                                          <span>{formatCompactDuration(msg.recipe.prepTime)}</span>
                                        </span>
                                      )}
                                      {msg.recipe.difficulty && (
                                        <span className={styles.statItem}>
                                          <Flame size={12} strokeWidth={2.3} aria-hidden="true" />
                                          <span>{msg.recipe.difficulty}</span>
                                        </span>
                                      )}
                                      {msg.recipe.servings && (
                                        <span className={styles.statItem}>
                                          <Users size={12} strokeWidth={2.3} aria-hidden="true" />
                                          <span>{msg.recipe.servings} serv</span>
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {msg.text && (
                                  <p className={styles.recipeNote}>
                                    &ldquo;{msg.text}&rdquo;
                                  </p>
                                )}

                                <div className={styles.recipeActions}>
                                  {onSelectRecipe && (
                                    <button
                                      type="button"
                                      className={styles.viewRecipeBtn}
                                      onClick={() => onSelectRecipe(msg.recipe)}
                                    >
                                      <BookOpen size={14} strokeWidth={2.3} aria-hidden="true" />
                                      <span>View</span>
                                    </button>
                                  )}
                                  {onSaveRecipe && !isMe && (
                                    <button
                                      type="button"
                                      className={`${styles.saveRecipeBtn} ${
                                        isAlreadySaved ? styles.savedBtn : ''
                                      }`}
                                      onClick={() =>
                                        handleSaveRecipeClick(
                                          msg.id,
                                          msg.recipe
                                        )
                                      }
                                      disabled={isAlreadySaved}
                                    >
                                      {isAlreadySaved ? (
                                        <>
                                          <Check size={14} strokeWidth={2.6} aria-hidden="true" />
                                          <span>Saved</span>
                                        </>
                                      ) : (
                                        <>
                                          <BookmarkPlus size={14} strokeWidth={2.3} aria-hidden="true" />
                                          <span>Save</span>
                                        </>
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div
                                className={`${styles.textBubble} ${
                                  isMe ? styles.bubbleMe : styles.bubbleOther
                                }`}
                              >
                                {msg.text}
                              </div>
                            )}

                            <span className={styles.messageTime}>
                              {formatTimestamp(msg.createdAt)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input Bar */}
                <form
                  onSubmit={handleSendText}
                  className={styles.inputContainer}
                >
                  <input
                    type="text"
                    className={styles.textInput}
                    placeholder={`Message ${
                      activeFriend.displayName || 'friend'
                    }...`}
                    aria-label={`Message ${activeFriend.displayName || 'friend'}`}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                  />
                  <button
                    type="submit"
                    className={styles.sendButton}
                    disabled={!inputText.trim() || sending}
                  >
                    <Send size={15} strokeWidth={2.4} aria-hidden="true" />
                    <span>{sending ? 'Sending...' : 'Send'}</span>
                  </button>
                </form>
              </>
            ) : (
              <>
                <div className={styles.emptyThreadTopBar}>
                  <button
                    type="button"
                    className={styles.closeBtn}
                    onClick={onClose}
                    aria-label="Close chat"
                    title="Close Chat"
                  >
                    <X size={18} strokeWidth={2.5} aria-hidden="true" />
                  </button>
                </div>
                <div className={styles.noActiveChat}>
                  <span className={styles.noActiveIcon} aria-hidden="true">
                    <MessageCircle size={40} strokeWidth={2} />
                  </span>
                  <p>Select a friend to start chatting</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
