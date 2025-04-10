// src/controllers/messageController.ts
import { Request, Response } from "express";
import { s3, dynamoDB, S3_BUCKET_NAME, DYNAMO_TABLE_NAME } from "../utils/aws";
import {
  generateMessageId,
  encryptMessage,
  decryptMessage,
  generateDHKeyPair,
  computeSharedSecret,
} from "../utils/crypto";

// Interface for the message stored in DynamoDB
interface Message {
  messageId: string;
  encrypted: string;
  iv: string;
  authTag: string;
  publicKey: string;
  prime: string;
  generator: string;
  createdAt: string;
  expiresAt: string;
}

export const createMessage = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message content is required" });
    }

    // Generate a message ID
    const messageId = generateMessageId();

    // Generate DH key pair
    const { privateKey, publicKey, prime, generator } = generateDHKeyPair();

    // Encrypt the message using the private key as basis for encryption key
    // In a real DH exchange, you'd use computeSharedSecret with the other party's public key
    // But for this one-way scenario, we're using our private key as the base for the encryption key
    const encryptionKey = privateKey;
    const encryptedData = encryptMessage(message, encryptionKey);

    // Calculate expiration (24 hours from now)
    const now = new Date();
    const expirationDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Prepare metadata for DynamoDB
    const messageItem: Message = {
      messageId,
      encrypted: encryptedData.encrypted,
      iv: encryptedData.iv,
      authTag: encryptedData.authTag,
      publicKey,
      prime,
      generator,
      createdAt: now.toISOString(),
      expiresAt: expirationDate.toISOString(),
    };

    // Upload encrypted message metadata to DynamoDB
    await dynamoDB
      .put({
        TableName: DYNAMO_TABLE_NAME,
        Item: messageItem,
      })
      .promise();

    // Optional: Upload the encrypted message to S3 as well if it's large
    // For simplicity, we're just using DynamoDB in this example

    // Return the necessary information to the client
    res.status(201).json({
      messageId,
      decryptionKey: privateKey, // The shared secret for decryption
      accessUrl: `/api/messages/${messageId}`, // Frontend will compose the full URL
      expiresAt: expirationDate.toISOString(),
    });
  } catch (error) {
    console.error("Error creating message:", error);
    res.status(500).json({ error: "Failed to create message" });
  }
};

export const getMessage = async (req: Request, res: Response): Promise<any> => {
  try {
    const { messageId } = req.params;

    // Get message metadata from DynamoDB
    const result = await dynamoDB
      .get({
        TableName: DYNAMO_TABLE_NAME,
        Key: { messageId },
      })
      .promise();

    if (!result.Item) {
      return res.status(404).json({ error: "Message not found" });
    }

    const messageData = result.Item as Message;

    // Check if message has expired
    if (new Date(messageData.expiresAt) < new Date()) {
      return res.status(410).json({ error: "Message has expired" });
    }

    // Return only the public key, prime, generator and message ID
    // The actual message will be decrypted client-side
    res.status(200).json({
      messageId: messageData.messageId,
      publicKey: messageData.publicKey,
      prime: messageData.prime,
      generator: messageData.generator,
      requiresKey: true,
    });
  } catch (error) {
    console.error("Error retrieving message:", error);
    res.status(500).json({ error: "Failed to retrieve message" });
  }
};

export const decryptMessageContent = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { messageId } = req.params;
    const { decryptionKey } = req.body;

    if (!decryptionKey) {
      return res.status(400).json({ error: "Decryption key is required" });
    }

    // Get message metadata from DynamoDB
    const result = await dynamoDB
      .get({
        TableName: DYNAMO_TABLE_NAME,
        Key: { messageId },
      })
      .promise();

    if (!result.Item) {
      return res.status(404).json({ error: "Message not found" });
    }

    const messageData = result.Item as Message;

    // Check if message has expired
    if (new Date(messageData.expiresAt) < new Date()) {
      return res.status(410).json({ error: "Message has expired" });
    }

    try {
      // In a true Diffie-Hellman exchange, you'd use computeSharedSecret here
      // But for this one-way case, we're directly using the decryption key provided
      const encryptedData = {
        encrypted: messageData.encrypted,
        iv: messageData.iv,
        authTag: messageData.authTag,
      };

      // Try to decrypt the message
      const decryptedMessage = decryptMessage(encryptedData, decryptionKey);

      // Optional: Delete the message after it's been read for true one-time use
      // await dynamoDB.delete({
      //   TableName: DYNAMO_TABLE_NAME,
      //   Key: { messageId }
      // }).promise();

      res.status(200).json({ message: decryptedMessage });
    } catch (error) {
      console.error("Decryption error:", error);
      res.status(400).json({ error: "Invalid decryption key" });
    }
  } catch (error) {
    console.error("Error decrypting message:", error);
    res.status(500).json({ error: "Failed to decrypt message" });
  }
};
