// src/utils/crypto.ts
import { v4 as uuidv4 } from 'uuid';
import CryptoJS from 'crypto-js';

// Generate random prime-like numbers for Diffie-Hellman
// Note: In production, use a proper crypto library for DH key exchange
export const generateKeyPair = () => {
  // This is a simplified version - not actual DH
  const privateKey = CryptoJS.lib.WordArray.random(16).toString();
  const publicKey = CryptoJS.SHA256(privateKey).toString();
  
  return {
    privateKey,
    publicKey
  };
};

export const generateMessageId = (): string => {
  return uuidv4();
};

export const encryptMessage = (message: string, key: string): string => {
  return CryptoJS.AES.encrypt(message, key).toString();
};

export const decryptMessage = (encryptedMessage: string, key: string): string => {
  const bytes = CryptoJS.AES.decrypt(encryptedMessage, key);
  return bytes.toString(CryptoJS.enc.Utf8);
};