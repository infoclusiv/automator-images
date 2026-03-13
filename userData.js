const extensionId = "flow-images-automator";
const defaultQuota = 30;

function makeTimestamp(date = new Date()) {
  return {
    toDate() {
      return date;
    },
    valueOf() {
      return date.valueOf();
    },
    toJSON() {
      return date.toISOString();
    },
  };
}

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }

  if (value && typeof value === "object") {
    if (typeof value.toDate === "function") {
      return value;
    }

    const result = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      result[key] = cloneValue(nestedValue);
    }
    return result;
  }

  return value;
}

function mergeDeep(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof value.toDate !== "function"
    ) {
      if (!target[key] || typeof target[key] !== "object" || Array.isArray(target[key])) {
        target[key] = {};
      }
      mergeDeep(target[key], value);
    } else {
      target[key] = cloneValue(value);
    }
  }
  return target;
}

const store = new Map();
const watchers = new Map();

function pathFromArgs(args) {
  return args.filter((part) => typeof part === "string" && part.length > 0).join("/");
}

function makeRef(kind, args) {
  return {
    kind,
    path: pathFromArgs(args),
  };
}

function makeDocSnapshot(path, value) {
  return {
    id: path.split("/").pop() || "mock-doc",
    exists() {
      return value !== undefined;
    },
    data() {
      return value === undefined ? undefined : cloneValue(value);
    },
  };
}

function makeQuerySnapshot(path) {
  const prefix = path ? `${path}/` : "";
  const docs = [];

  for (const [storedPath, storedValue] of store.entries()) {
    if (!storedPath.startsWith(prefix)) {
      continue;
    }

    const remaining = storedPath.slice(prefix.length);
    if (remaining.includes("/")) {
      continue;
    }

    docs.push(makeDocSnapshot(storedPath, storedValue));
  }

  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    forEach(callback) {
      docs.forEach(callback);
    },
  };
}

function emitWatchers(path) {
  const pathsToNotify = [path];
  const parts = path.split("/");

  while (parts.length > 1) {
    parts.pop();
    pathsToNotify.push(parts.join("/"));
  }

  for (const watcherPath of pathsToNotify) {
    const callbacks = watchers.get(watcherPath);
    if (!callbacks) {
      continue;
    }

    const payload = store.has(watcherPath)
      ? makeDocSnapshot(watcherPath, store.get(watcherPath))
      : makeQuerySnapshot(watcherPath);

    callbacks.forEach((callback) => {
      setTimeout(() => callback(payload), 0);
    });
  }
}

const mockUser = {
  uid: "local-user",
  email: "local@bypass.ext",
  displayName: "Local User",
  photoURL: null,
  providerId: "password",
  emailVerified: true,
  isAnonymous: false,
  metadata: {
    creationTime: new Date().toISOString(),
    lastSignInTime: new Date().toISOString(),
  },
  async getIdToken() {
    return "local-bypass-token";
  },
  async reload() {},
  toJSON() {
    return {
      uid: this.uid,
      email: this.email,
      displayName: this.displayName,
    };
  },
};

const authListeners = new Set();

const auth = {
  currentUser: mockUser,
  onAuthStateChanged(callback) {
    authListeners.add(callback);
    setTimeout(() => callback(this.currentUser), 0);
    return () => authListeners.delete(callback);
  },
  async signOut() {
    this.currentUser = null;
    notifyAuthListeners();
    return undefined;
  },
};

function notifyAuthListeners() {
  authListeners.forEach((callback) => {
    setTimeout(() => callback(auth.currentUser), 0);
  });
}

const db = {};

function buildSubscription() {
  return {
    status: "active",
    originalStatus: "active",
    plan: "lifetime",
    quota: defaultQuota,
    used: 0,
    remaining: 999999,
    canContinue: true,
    isPaid: true,
    startDate: makeTimestamp(),
    endDate: makeTimestamp(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)),
  };
}

function buildUserDoc() {
  return {
    uid: mockUser.uid,
    email: mockUser.email,
    displayName: mockUser.displayName,
    createdAt: makeTimestamp(),
    updatedAt: makeTimestamp(),
    subscriptions: {
      [extensionId]: buildSubscription(),
    },
  };
}

store.set(`users/${mockUser.uid}`, buildUserDoc());

async function createUserWithEmailAndPasswordImpl(currentAuth, email) {
  currentAuth.currentUser = {
    ...mockUser,
    email,
    providerData: [{ providerId: "password" }],
  };
  store.set(`users/${currentAuth.currentUser.uid}`, {
    ...buildUserDoc(),
    email,
  });
  notifyAuthListeners();
  return { user: currentAuth.currentUser };
}

async function signInWithEmailAndPasswordImpl(currentAuth, email) {
  currentAuth.currentUser = {
    ...mockUser,
    email,
    providerData: [{ providerId: "password" }],
  };
  if (!store.has(`users/${currentAuth.currentUser.uid}`)) {
    store.set(`users/${currentAuth.currentUser.uid}`, {
      ...buildUserDoc(),
      email,
    });
  }
  notifyAuthListeners();
  return { user: currentAuth.currentUser };
}

async function signInWithGoogleImpl() {
  auth.currentUser = {
    ...mockUser,
    providerData: [{ providerId: "google.com" }],
  };
  notifyAuthListeners();
  return { user: auth.currentUser };
}

async function initializeUserImpl(user, currentExtensionId = extensionId) {
  const path = `users/${user?.uid || mockUser.uid}`;
  const existing = store.get(path) || buildUserDoc();
  existing.email = user?.email || existing.email;
  existing.displayName = user?.displayName || existing.displayName;
  existing.subscriptions[currentExtensionId] = buildSubscription();
  existing.updatedAt = makeTimestamp();
  store.set(path, existing);
  emitWatchers(path);
  return existing;
}

async function sendEmailVerificationImpl() {
  return undefined;
}

async function sendPasswordResetEmailImpl() {
  return undefined;
}

function getDocData(path) {
  if (store.has(path)) {
    return store.get(path);
  }

  if (path === `users/${mockUser.uid}`) {
    const fallback = buildUserDoc();
    store.set(path, fallback);
    return fallback;
  }

  return undefined;
}

async function getDocImpl(ref) {
  return makeDocSnapshot(ref.path, getDocData(ref.path));
}

async function getDocsImpl(ref) {
  return makeQuerySnapshot(ref.path);
}

async function setDocImpl(ref, value) {
  store.set(ref.path, cloneValue(value));
  emitWatchers(ref.path);
}

async function updateDocImpl(ref, value) {
  const current = cloneValue(getDocData(ref.path) || {});
  const next = mergeDeep(current, value);
  store.set(ref.path, next);
  emitWatchers(ref.path);
}

async function deleteDocImpl(ref) {
  store.delete(ref.path);
  emitWatchers(ref.path);
}

function onSnapshotImpl(ref, next, error) {
  try {
    const callback = () => {
      const payload = ref.kind === "doc"
        ? makeDocSnapshot(ref.path, getDocData(ref.path))
        : makeQuerySnapshot(ref.path);
      next(payload);
    };

    if (!watchers.has(ref.path)) {
      watchers.set(ref.path, new Set());
    }

    watchers.get(ref.path).add(callback);
    setTimeout(callback, 0);

    return () => {
      const callbacks = watchers.get(ref.path);
      if (!callbacks) {
        return;
      }
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        watchers.delete(ref.path);
      }
    };
  } catch (caughtError) {
    if (typeof error === "function") {
      error(caughtError);
    }
    return () => {};
  }
}

async function addDocImpl(ref, value) {
  const id = `mock-${Math.random().toString(36).slice(2, 10)}`;
  const createdRef = makeRef("doc", [ref.path, id]);
  await setDocImpl(createdRef, value);
  return { id, path: createdRef.path };
}

function collectionImpl(...args) {
  return makeRef("collection", args);
}

function docImpl(...args) {
  return makeRef("doc", args);
}

function queryImpl(ref, ...constraints) {
  return {
    kind: ref?.kind || "query",
    path: ref?.path || "",
    constraints,
  };
}

function orderByImpl(field, direction = "asc") {
  return {
    type: "orderBy",
    field,
    direction,
  };
}

function onAuthStateChangedImpl(currentAuth, callback) {
  return currentAuth.onAuthStateChanged(callback);
}

async function getUserSubscriptionImpl(userId, currentExtensionId = extensionId) {
  const userDoc = getDocData(`users/${userId || mockUser.uid}`) || buildUserDoc();
  return cloneValue(userDoc.subscriptions[currentExtensionId] || buildSubscription());
}

function watchUserSubscriptionImpl(userId, currentExtensionId = extensionId, callback) {
  const ref = docImpl(db, "users", userId || mockUser.uid);
  return onSnapshotImpl(ref, (snapshot) => {
    const data = snapshot.data() || buildUserDoc();
    callback(cloneValue(data.subscriptions[currentExtensionId] || buildSubscription()));
  });
}

async function getUserProfileImpl(userId = mockUser.uid) {
  const userDoc = getDocData(`users/${userId}`) || buildUserDoc();
  return cloneValue(userDoc);
}

function watchUserProfileImpl(userId = mockUser.uid, callback) {
  const ref = docImpl(db, "users", userId);
  return onSnapshotImpl(ref, (snapshot) => {
    callback(snapshot.data() || buildUserDoc());
  });
}

function serverTimestamp() {
  return makeTimestamp();
}

export const a = () => makeTimestamp();
export const b = docImpl;
export const c = collectionImpl;
export const d = db;
export const e = getDocsImpl;
export const f = signInWithGoogleImpl;
export const g = getDocImpl;
export const h = createUserWithEmailAndPasswordImpl;
export const i = auth;
export const j = initializeUserImpl;
export const k = sendEmailVerificationImpl;
export const l = signInWithEmailAndPasswordImpl;
export const m = initializeUserImpl;
export const n = sendPasswordResetEmailImpl;
export const o = onSnapshotImpl;
export const p = orderByImpl;
export const q = queryImpl;
export const r = onAuthStateChangedImpl;
export const s = setDocImpl;
export const t = updateDocImpl;
export const u = updateDocImpl;
export const E = extensionId;
export const F = defaultQuota;

export {
  auth,
  db,
  addDocImpl as addDoc,
  collectionImpl as collection,
  createUserWithEmailAndPasswordImpl as createUserWithEmailAndPassword,
  deleteDocImpl as deleteDoc,
  docImpl as doc,
  getDocImpl as getDoc,
  getDocsImpl as getDocs,
  getUserProfileImpl as getUserProfile,
  getUserSubscriptionImpl as getUserSubscription,
  initializeUserImpl as initializeUser,
  onAuthStateChangedImpl as onAuthStateChanged,
  onSnapshotImpl as onSnapshot,
  orderByImpl as orderBy,
  queryImpl as query,
  sendEmailVerificationImpl as sendEmailVerification,
  sendPasswordResetEmailImpl as sendPasswordResetEmail,
  serverTimestamp,
  setDocImpl as setDoc,
  signInWithEmailAndPasswordImpl as signInWithEmailAndPassword,
  signInWithGoogleImpl as signInWithGoogle,
  updateDocImpl as updateDoc,
  watchUserProfileImpl as watchUserProfile,
  watchUserSubscriptionImpl as watchUserSubscription,
};

export default {
  auth,
  db,
  extensionId,
  defaultQuota,
};