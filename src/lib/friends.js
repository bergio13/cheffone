import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from './firebase';

// ── User profile ───────────────────────────────────────────────────────────────
export async function getUserSavedRecipes(uid) {
  try {
    const q = query(collection(db, 'users', uid, 'recipes'), orderBy('parsedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data());
  } catch (e) {
    console.error('Error fetching user recipes:', e);
    return [];
  }
}

export async function createUserProfile(user) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  const displayName = user.displayName || '';
  const data = {
    uid: user.uid,
    displayName,
    // Normalized for case-insensitive username search
    usernameLower: displayName.toLowerCase().trim(),
    email: user.email || '',
    photoURL: user.photoURL || '',
  };
  if (!snap.exists()) {
    await setDoc(ref, { ...data, createdAt: serverTimestamp() });
  } else {
    await updateDoc(ref, data);
  }
}

// ── Search users ───────────────────────────────────────────────────────────────
// Searches by username (displayName, case-insensitive) first, then by exact email.
export async function searchUserByUsername(input) {
  const normalized = input.toLowerCase().trim();

  // Try username match first
  const nameQ = query(
    collection(db, 'users'),
    where('usernameLower', '==', normalized)
  );
  const nameSnap = await getDocs(nameQ);
  if (!nameSnap.empty) return nameSnap.docs[0].data();

  // Fall back to email
  const emailQ = query(
    collection(db, 'users'),
    where('email', '==', normalized)
  );
  const emailSnap = await getDocs(emailQ);
  if (!emailSnap.empty) return emailSnap.docs[0].data();

  return null;
}


// ── Friend requests ────────────────────────────────────────────────────────────
export async function sendFriendRequest(fromUser, toUid) {
  if (fromUser.uid === toUid) throw new Error("You can't add yourself.");

  // Check already friends by checking accepted requests in friendRequests
  const q1 = query(
    collection(db, 'friendRequests'),
    where('fromUid', '==', fromUser.uid),
    where('toUid', '==', toUid),
    where('status', '==', 'accepted')
  );
  const q2 = query(
    collection(db, 'friendRequests'),
    where('fromUid', '==', toUid),
    where('toUid', '==', fromUser.uid),
    where('status', '==', 'accepted')
  );
  const [friendsSnap1, friendsSnap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
  if (!friendsSnap1.empty || !friendsSnap2.empty) throw new Error('Already friends!');

  // Check already pending
  const qPending = query(
    collection(db, 'friendRequests'),
    where('fromUid', '==', fromUser.uid),
    where('toUid', '==', toUid),
    where('status', '==', 'pending')
  );
  const existing = await getDocs(qPending);
  if (!existing.empty) throw new Error('Friend request already sent.');

  await addDoc(collection(db, 'friendRequests'), {
    fromUid: fromUser.uid,
    toUid,
    fromName: fromUser.displayName || fromUser.email,
    fromEmail: fromUser.email,
    fromPhoto: fromUser.photoURL || '',
    status: 'pending',
    createdAt: serverTimestamp(),
  });
}

export async function getPendingRequests(uid) {
  const q = query(
    collection(db, 'friendRequests'),
    where('toUid', '==', uid),
    where('status', '==', 'pending')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function acceptFriendRequest(requestId, fromUid, toUid) {
  await updateDoc(doc(db, 'friendRequests', requestId), { status: 'accepted' });
}

export async function declineFriendRequest(requestId) {
  await updateDoc(doc(db, 'friendRequests', requestId), { status: 'declined' });
}

// ── Friends list ───────────────────────────────────────────────────────────────
export async function getFriends(uid) {
  const q1 = query(
    collection(db, 'friendRequests'),
    where('fromUid', '==', uid),
    where('status', '==', 'accepted')
  );
  const q2 = query(
    collection(db, 'friendRequests'),
    where('toUid', '==', uid),
    where('status', '==', 'accepted')
  );
  const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

  const friendUids = new Set();
  snap1.forEach((d) => friendUids.add(d.data().toUid));
  snap2.forEach((d) => friendUids.add(d.data().fromUid));

  if (friendUids.size === 0) return [];

  const profiles = await Promise.all(
    Array.from(friendUids).map(async (fUid) => {
      const uSnap = await getDoc(doc(db, 'users', fUid));
      return uSnap.exists() ? uSnap.data() : null;
    })
  );

  return profiles.filter((p) => p !== null);
}

// ── 1-on-1 Chat & Recipe Sharing ─────────────────────────────────────────────
export function getChatId(uid1, uid2) {
  return [uid1, uid2].sort().join('_');
}

export async function sendChatMessage(fromUser, toUid, messageData) {
  const chatId = getChatId(fromUser.uid, toUid);
  const chatRef = doc(db, 'chats', chatId);
  const messagesRef = collection(db, 'chats', chatId, 'messages');

  const senderName = fromUser.displayName || fromUser.email?.split('@')[0] || 'Chef';
  const senderPhoto = fromUser.photoURL || '';

  const messageDoc = {
    senderUid: fromUser.uid,
    senderName,
    senderPhoto,
    createdAt: serverTimestamp(),
    ...messageData,
  };

  await addDoc(messagesRef, messageDoc);

  const lastText =
    messageData.type === 'recipe'
      ? `🍳 Shared recipe: ${messageData.recipe?.title || 'a recipe'}`
      : messageData.text || '';

  const chatSnap = await getDoc(chatRef);

  let toPhoto = '';
  let toName = '';
  if (chatSnap.exists()) {
    const existing = chatSnap.data();
    toName = existing.participantInfo?.[toUid]?.displayName || '';
    toPhoto = existing.participantInfo?.[toUid]?.photoURL || '';
  }
  if (!toName) {
    const recipientSnap = await getDoc(doc(db, 'users', toUid));
    if (recipientSnap.exists()) {
      const rData = recipientSnap.data();
      toName = rData.displayName || rData.email?.split('@')[0] || '';
      toPhoto = rData.photoURL || '';
    }
  }

  const participantInfo = {
    [fromUser.uid]: {
      displayName: senderName,
      photoURL: senderPhoto,
      email: fromUser.email || '',
    },
    [toUid]: {
      displayName: toName || 'Friend',
      photoURL: toPhoto,
      email: '',
    },
  };

  const updateData = {
    chatId,
    participants: [fromUser.uid, toUid],
    participantInfo,
    lastMessage: lastText,
    lastMessageAt: serverTimestamp(),
    lastSenderUid: fromUser.uid,
    unreadBy: arrayUnion(toUid),
  };

  if (!chatSnap.exists()) {
    await setDoc(chatRef, updateData);
  } else {
    await setDoc(
      chatRef,
      {
        ...updateData,
        participantInfo: {
          ...(chatSnap.data().participantInfo || {}),
          ...participantInfo,
        },
      },
      { merge: true }
    );
  }
}

export async function shareRecipeWithFriend(fromUser, toUid, recipe, messageText = '') {
  await sendChatMessage(fromUser, toUid, {
    type: 'recipe',
    text: messageText,
    recipe,
  });
}

export function subscribeToChatMessages(chatId, callback, onError) {
  const q = query(
    collection(db, 'chats', chatId, 'messages'),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(
    q,
    (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(msgs);
    },
    (err) => {
      console.warn('subscribeToChatMessages permission error:', err);
      if (onError) onError(err);
    }
  );
}

export function subscribeToUserChats(uid, callback, onError) {
  const q = query(
    collection(db, 'chats'),
    where('participants', 'array-contains', uid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const chats = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      chats.sort((a, b) => {
        const tA = a.lastMessageAt?.toMillis ? a.lastMessageAt.toMillis() : 0;
        const tB = b.lastMessageAt?.toMillis ? b.lastMessageAt.toMillis() : 0;
        return tB - tA;
      });
      callback(chats);
    },
    (err) => {
      console.warn('subscribeToUserChats permission error:', err);
      if (onError) onError(err);
    }
  );
}

export async function markChatAsRead(chatId, uid) {
  const chatRef = doc(db, 'chats', chatId);
  try {
    const snap = await getDoc(chatRef);
    if (snap.exists()) {
      await setDoc(
        chatRef,
        {
          unreadBy: arrayRemove(uid),
        },
        { merge: true }
      );
    }
  } catch (e) {
    console.error('markChatAsRead error:', e);
  }
}

// ── Daily Parse Limits ────────────────────────────────────────────────────────
export async function getParseLimitStatus(uid, limit = 5) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { allowed: true, count: 0, limit };

  const data = snap.data();
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  if (data.lastParseDate === today) {
    const currentCount = data.parseCountToday || 0;
    return {
      allowed: currentCount < limit,
      count: currentCount,
      limit
    };
  }

  return { allowed: true, count: 0, limit };
}

export async function incrementParseCount(uid) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  const today = new Date().toISOString().split('T')[0];

  if (!snap.exists()) return;
  const data = snap.data();

  let newCount = 1;
  if (data.lastParseDate === today) {
    newCount = (data.parseCountToday || 0) + 1;
  }

  await updateDoc(ref, {
    lastParseDate: today,
    parseCountToday: newCount
  });
}

