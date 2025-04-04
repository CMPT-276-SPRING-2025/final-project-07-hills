export const app = {};
export const auth = {};
export const db = {};
export const storage = {};
export const googleProvider = {
  setCustomParameters: () => {},
};

export const getAuth = () => auth;
export const getFirestore = () => db;
export const getStorage = () => storage;
export const initializeApp = () => app;
export const getApp = () => app;
export const getApps = () => [];
export const GoogleAuthProvider = class {
  setCustomParameters = () => {};
};
