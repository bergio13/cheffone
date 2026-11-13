'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

const LOCAL_KEY = 'cheffone_recipes';

const recipesCol = (uid) => collection(db, 'users', uid, 'recipes');

function saveLocalRecipes(list) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Unable to cache recipes in localStorage:', e);
  }
}

/**
 * Recipe persistence: Firestore when signed in, localStorage otherwise.
 * Migrates local recipes to Firestore on first login.
 * `onLoad(recipes)` fires after the initial load so the page can pick an active recipe.
 */
export function useRecipes(user, onLoad) {
  const [recipes, setRecipes] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const recipesRef = useRef([]); // mirrors `recipes` so persistence never reads a deferred updater
  const hasMigratedRef = useRef(false);
  const onLoadRef = useRef(onLoad);

  useEffect(() => {
    onLoadRef.current = onLoad;
  }, [onLoad]);

  const commit = useCallback((next) => {
    recipesRef.current = next;
    setRecipes(next);
  }, []);

  useEffect(() => {
    if (user === undefined) return; // auth still loading
    let cancelled = false;

    const migrate = async (uid) => {
      if (hasMigratedRef.current) return;
      hasMigratedRef.current = true;
      const saved = localStorage.getItem(LOCAL_KEY);
      if (!saved) return;
      try {
        const local = JSON.parse(saved);
        if (!local.length) return;
        const batch = writeBatch(db);
        local.forEach((r) => {
          const docId = String(r.id);
          batch.set(doc(db, 'users', uid, 'recipes', docId), { ...r, id: docId });
        });
        await batch.commit();
        localStorage.removeItem(LOCAL_KEY);
      } catch (e) {
        console.error('Migration error:', e);
      }
    };

    const loadRemote = async (uid) => {
      setIsSyncing(true);
      try {
        await migrate(uid);
        const snap = await getDocs(query(recipesCol(uid), orderBy('parsedAt', 'desc')));
        const loaded = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        if (cancelled) return;
        commit(loaded);
        onLoadRef.current?.(loaded);
      } catch (e) {
        console.error('Firestore load error:', e);
      } finally {
        if (!cancelled) setIsSyncing(false);
      }
    };

    if (user) {
      loadRemote(user.uid);
    } else {
      let loaded = [];
      try {
        loaded = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
      } catch (e) {
        console.error('Failed to parse saved recipes:', e);
      }
      // Defer so state isn't set synchronously inside the effect body.
      queueMicrotask(() => {
        if (cancelled) return;
        commit(loaded);
        onLoadRef.current?.(loaded);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [user, commit]);

  /** Prepend a new recipe (or replace one with the same id) and persist it. */
  const saveRecipe = useCallback(
    async (recipe) => {
      const docId = String(recipe.id);
      const normalized = { ...recipe, id: docId };
      const next = [normalized, ...recipesRef.current.filter((r) => String(r.id) !== docId)];
      commit(next);
      if (user) {
        await setDoc(doc(db, 'users', user.uid, 'recipes', docId), normalized);
      } else {
        saveLocalRecipes(next);
      }
    },
    [user, commit]
  );

  const removeRecipe = useCallback(
    async (id) => {
      const docId = String(id);
      const next = recipesRef.current.filter((r) => String(r.id) !== docId);
      commit(next);
      if (user) {
        await deleteDoc(doc(db, 'users', user.uid, 'recipes', docId));
      } else {
        saveLocalRecipes(next);
      }
    },
    [user, commit]
  );

  /** Updates dishVisual fields in-place for existing saved recipes without altering order. */
  const updateRecipeVisuals = useCallback(
    async (visualsById) => {
      if (!visualsById || Object.keys(visualsById).length === 0) return;
      const next = recipesRef.current.map((r) => {
        const visual = visualsById[String(r.id)];
        return visual ? { ...r, dishVisual: visual } : r;
      });
      commit(next);
      if (user) {
        const batch = writeBatch(db);
        for (const [id, dishVisual] of Object.entries(visualsById)) {
          batch.set(doc(db, 'users', user.uid, 'recipes', String(id)), { dishVisual }, { merge: true });
        }
        await batch.commit();
      } else {
        saveLocalRecipes(next);
      }
    },
    [user, commit]
  );

  const clearRecipes = useCallback(() => commit([]), [commit]);

  return { recipes, isSyncing, saveRecipe, updateRecipeVisuals, removeRecipe, clearRecipes };
}
