// src/utils/crypto.ts
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import CryptoJS from 'crypto-js';

// Generate Diffie-Hellman key pair
export const generateDHKeyPair = () => {
  // Create a Diffie-Hellman instance with predefined prime and generator
  // Using the modp14 group (2048 bits) from RFC 3526
  const dh = crypto.createDiffieHellman(2048);
  
  // Generate keys
  dh.generateKeys();
  
  // Get the keys as base64 strings
  const privateKey = dh.getPrivateKey('base64');
  const publicKey = dh.getPublicKey('base64');
  const prime = dh.getPrime('base64');
  const generator = dh.getGenerator('base64');
  
  return {
    privateKey,
    publicKey,
    prime,
    generator
  };
};

// Generate a shared secret using our private key and their public key
export const computeSharedSecret = (
  privateKey: string, 
  otherPublicKey: string,
  prime: string,
  generator: string
) => {
  // Recreate DH instance with the same prime and generator
  const dh = crypto.createDiffieHellman(
    Buffer.from(prime, 'base64'),
    Buffer.from(generator, 'base64')
  );
  
  // Set our private key
  dh.setPrivateKey(Buffer.from(privateKey, 'base64'));
  
  // Compute shared secret using the other person's public key
  const sharedSecret = dh.computeSecret(Buffer.from(otherPublicKey, 'base64'));
  
  // Use a hash of the shared secret as the encryption key
  // This provides better key distribution
  return crypto.createHash('sha256').update(sharedSecret).digest('base64');
};

export const generateMessageId = (): string => {
  return uuidv4();
};

// Encrypt using AES-256-GCM for authenticated encryption
export const encryptMessage = (message: string, key: string): { encrypted: string, iv: string, authTag: string } => {
  // Convert the key to appropriate format (32 bytes for AES-256)
  const keyBuffer = Buffer.from(key, 'base64').slice(0, 32);
  
  // Generate a random initialization vector
  const iv = crypto.randomBytes(16);
  
  // Create cipher
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
  
  // Encrypt the message
  let encrypted = cipher.update(message, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  // Get the authentication tag
  const authTag = cipher.getAuthTag().toString('base64');
  
  return {
    encrypted,
    iv: iv.toString('base64'),
    authTag
  };
};

// Decrypt using AES-256-GCM
export const decryptMessage = (
  encryptedData: { encrypted: string, iv: string, authTag: string }, 
  key: string
): string => {
  try {
    // Convert the key to appropriate format
    const keyBuffer = Buffer.from(key, 'base64').slice(0, 32);
    
    // Convert IV and auth tag back to buffers
    const iv = Buffer.from(encryptedData.iv, 'base64');
    const authTag = Buffer.from(encryptedData.authTag, 'base64');
    
    // Create decipher
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt the message
    let decrypted = decipher.update(encryptedData.encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error('Decryption failed. Invalid key or corrupted message.');
  }
};