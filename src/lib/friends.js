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
} from 'firebase/firestore';
import { db } from './firebase';

// ── User profile ───────────────────────────────────────────────────────────────
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

// ── Inbox (shared recipes) ─────────────────────────────────────────────────────
export async function shareRecipeWithFriend(fromUser, toUid, recipe) {
  const shareId = `${fromUser.uid}_${recipe.id}_${Date.now()}`;
  await setDoc(doc(db, 'users', toUid, 'inbox', shareId), {
    id: shareId,
    recipe,
    fromUid: fromUser.uid,
    fromName: fromUser.displayName || fromUser.email,
    fromPhoto: fromUser.photoURL || '',
    sharedAt: serverTimestamp(),
    seen: false,
  });
}

export async function getInbox(uid) {
  const q = query(
    collection(db, 'users', uid, 'inbox'),
    orderBy('sharedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

export async function markInboxSeen(uid, shareId) {
  await updateDoc(doc(db, 'users', uid, 'inbox', shareId), { seen: true });
}

export async function deleteInboxItem(uid, shareId) {
  await deleteDoc(doc(db, 'users', uid, 'inbox', shareId));
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

