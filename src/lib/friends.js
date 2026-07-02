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
  const data = {
    uid: user.uid,
    displayName: user.displayName || '',
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
export async function searchUserByEmail(email) {
  const q = query(
    collection(db, 'users'),
    where('email', '==', email.toLowerCase().trim())
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data();
}

// ── Friend requests ────────────────────────────────────────────────────────────
export async function sendFriendRequest(fromUser, toUid) {
  if (fromUser.uid === toUid) throw new Error("You can't add yourself.");

  // Check already friends
  const friendSnap = await getDoc(doc(db, 'users', fromUser.uid, 'friends', toUid));
  if (friendSnap.exists()) throw new Error('Already friends!');

  // Check already pending
  const q = query(
    collection(db, 'friendRequests'),
    where('fromUid', '==', fromUser.uid),
    where('toUid', '==', toUid),
    where('status', '==', 'pending')
  );
  const existing = await getDocs(q);
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
  const [fromSnap, toSnap] = await Promise.all([
    getDoc(doc(db, 'users', fromUid)),
    getDoc(doc(db, 'users', toUid)),
  ]);
  const now = serverTimestamp();
  if (fromSnap.exists())
    await setDoc(doc(db, 'users', toUid, 'friends', fromUid), {
      ...fromSnap.data(),
      addedAt: now,
    });
  if (toSnap.exists())
    await setDoc(doc(db, 'users', fromUid, 'friends', toUid), {
      ...toSnap.data(),
      addedAt: now,
    });
}

export async function declineFriendRequest(requestId) {
  await updateDoc(doc(db, 'friendRequests', requestId), { status: 'declined' });
}

// ── Friends list ───────────────────────────────────────────────────────────────
export async function getFriends(uid) {
  const snap = await getDocs(collection(db, 'users', uid, 'friends'));
  return snap.docs.map((d) => d.data());
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
