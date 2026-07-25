'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './ChatModal.module.css';
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
      style={{ width: size, height: size, fontSize: size * 0.45 }}
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
}) {
  const [friends, setFriends] = useState([]);
  const [userChats, setUserChats] = useState([]);
  const [activeFriend, setActiveFriend] = useState(initialFriend);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [savedRecipes, setSavedRecipes] = useState(new Set());
  const [permissionError, setPermissionError] = useState(false);
  const messagesEndRef = useRef(null);

  // Load friends list
  useEffect(() => {
    if (!currentUser) return;
    getFriends(currentUser.uid).then((fList) => {
      setFriends(fList);
      if (!activeFriend && fList.length > 0 && !initialFriend) {
        setActiveFriend(fList[0]);
      }
    });
  }, [currentUser]);

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
      setMessages([]);
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

  const getFriendInfoForChat = (chat) => {
    const otherUid = chat.participants?.find((uid) => uid !== currentUser.uid);
    const fromFriendList = friends.find((f) => f.uid === otherUid);
    if (fromFriendList) return fromFriendList;

    const pInfo = chat.participantInfo?.[otherUid] || {};
    return {
      uid: otherUid,
      displayName: pInfo.displayName || 'Chef Friend',
      photoURL: pInfo.photoURL || '',
      email: pInfo.email || '',
    };
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose} title="Close Chat">
          ✕
        </button>

        <div className={styles.chatContainer}>
          {/* Sidebar Conversations / Friends */}
          <div className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
              <h3>💬 Kitchen Chat</h3>
            </div>

            {permissionError && (
              <div className={styles.permissionWarning}>
                ⚠️ Firestore Rules setup needed for chats collection. Check <code>firestore.rules</code>.
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
                    <div
                      key={friend.uid}
                      className={`${styles.friendItem} ${
                        isSelected ? styles.friendItemActive : ''
                      }`}
                      onClick={() => setActiveFriend(friend)}
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
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Main Chat Area */}
          <div className={styles.mainChat}>
            {activeFriend ? (
              <>
                {/* Chat Header */}
                <div className={styles.chatHeader}>
                  <Avatar user={activeFriend} size={36} />
                  <div className={styles.headerTitleGroup}>
                    <h4>{activeFriend.displayName || activeFriend.email}</h4>
                    <span className={styles.onlineBadge}>● Online Chef</span>
                  </div>
                </div>

                {/* Messages Stream */}
                <div className={styles.messagesList}>
                  {messages.length === 0 ? (
                    <div className={styles.emptyMessages}>
                      <span>💬</span>
                      <p>
                        Say hi to{' '}
                        <strong>
                          {activeFriend.displayName || 'your friend'}
                        </strong>
                        !
                      </p>
                      <p className={styles.subtext}>
                        Send text messages or share recipes directly here.
                      </p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMe = msg.senderUid === currentUser.uid;

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

                            {msg.type === 'recipe' && msg.recipe ? (
                              <div className={styles.recipeCardBubble}>
                                <div className={styles.recipeBubbleHeader}>
                                  <span className={styles.recipeTag}>
                                    🍳 RECIPE SHARED
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
                                    <span>⏱️ {msg.recipe.prepTime}</span>
                                  )}
                                  {msg.recipe.difficulty && (
                                    <span>🔥 {msg.recipe.difficulty}</span>
                                  )}
                                  {msg.recipe.servings && (
                                    <span>👥 {msg.recipe.servings} serv</span>
                                  )}
                                </div>

                                {msg.text && (
                                  <p className={styles.recipeNote}>
                                    "{msg.text}"
                                  </p>
                                )}

                                <div className={styles.recipeActions}>
                                  {onSelectRecipe && (
                                    <button
                                      className={styles.viewRecipeBtn}
                                      onClick={() => {
                                        onSelectRecipe(msg.recipe);
                                        onClose();
                                      }}
                                    >
                                      📖 View Recipe
                                    </button>
                                  )}
                                  {onSaveRecipe && (
                                    <button
                                      className={`${styles.saveRecipeBtn} ${
                                        savedRecipes.has(msg.id)
                                          ? styles.savedBtn
                                          : ''
                                      }`}
                                      onClick={() =>
                                        handleSaveRecipeClick(
                                          msg.id,
                                          msg.recipe
                                        )
                                      }
                                      disabled={savedRecipes.has(msg.id)}
                                    >
                                      {savedRecipes.has(msg.id)
                                        ? '✓ Saved'
                                        : '🍳 Save'}
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
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                  />
                  <button
                    type="submit"
                    className={styles.sendButton}
                    disabled={!inputText.trim() || sending}
                  >
                    {sending ? '...' : '📤 Send'}
                  </button>
                </form>
              </>
            ) : (
              <div className={styles.noActiveChat}>
                <span>💬</span>
                <p>Select a friend to start chatting</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
