import { Request, Response } from 'express';
import { s3, dynamoDB, S3_BUCKET_NAME, DYNAMO_TABLE_NAME } from '../utils/aws';
import { generateMessageId, encryptMessage, decryptMessage, generateKeyPair } from '../utils/crypto';
import { Message } from '../models/Message';

export const createMessage = async (req: Request, res: Response): Promise<any> => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message content is required' });
    }
    
    // Generate a message ID
    const messageId = generateMessageId();
    
    // Generate DH key pair
    const { privateKey, publicKey } = generateKeyPair();
    
    // Encrypt the message
    const encryptedContent = encryptMessage(message, privateKey);
    
    // Calculate expiration (24 hours from now)
    const now = new Date();
    const expirationDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    // Upload encrypted message to S3
    const s3Params = {
      Bucket: S3_BUCKET_NAME,
      Key: `messages/${messageId}`,
      Body: encryptedContent,
      ContentType: 'text/plain',
      Expires: expirationDate
    };
    
    await s3.putObject(s3Params).promise();
    
    // Store metadata in DynamoDB
    const messageItem: Message = {
      messageId,
      encryptedContent, // For simplicity - in production you'd only store the S3 reference here
      publicKey,
      createdAt: now.toISOString(),
      expiresAt: expirationDate.toISOString()
    };
    
    await dynamoDB.put({
      TableName: DYNAMO_TABLE_NAME,
      Item: messageItem
    }).promise();
    
    // Return the necessary information to the client
    res.status(201).json({
      messageId,
      privateKey, // The shared secret for decryption
      publicKey,
      accessUrl: `/api/messages/${messageId}`, // Frontend will compose the full URL
      expiresAt: expirationDate.toISOString()
    });
    
  } catch (error) {
    console.error('Error creating message:', error);
    res.status(500).json({ error: 'Failed to create message' });
  }
};

export const getMessage = async (req: Request, res: Response) : Promise<any> => {
  try {
    const { messageId } = req.params;
    
    // Get message metadata from DynamoDB
    const result = await dynamoDB.get({
      TableName: DYNAMO_TABLE_NAME,
      Key: { messageId }
    }).promise();
    
    if (!result.Item) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    const messageData = result.Item as Message;
    
    // Check if message has expired
    if (new Date(messageData.expiresAt) < new Date()) {
      return res.status(410).json({ error: 'Message has expired' });
    }
    
    // Return only the public key and message ID - message will be decrypted client-side
    res.status(200).json({
      messageId: messageData.messageId,
      publicKey: messageData.publicKey,
      requiresKey: true
    });
    
  } catch (error) {
    console.error('Error retrieving message:', error);
    res.status(500).json({ error: 'Failed to retrieve message' });
  }
};

export const decryptMessageContent = async (req: Request, res: Response): Promise<any> => {
  try {
    const { messageId } = req.params;
    const { decryptionKey } = req.body;
    
    if (!decryptionKey) {
      return res.status(400).json({ error: 'Decryption key is required' });
    }
    
    // Get message metadata from DynamoDB
    const result = await dynamoDB.get({
      TableName: DYNAMO_TABLE_NAME,
      Key: { messageId }
    }).promise();
    
    if (!result.Item) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    const messageData = result.Item as Message;
    
    // Check if message has expired
    if (new Date(messageData.expiresAt) < new Date()) {
      return res.status(410).json({ error: 'Message has expired' });
    }
    
    try {
      // Try to decrypt the message
      const decryptedMessage = decryptMessage(messageData.encryptedContent, decryptionKey);
      
      if (!decryptedMessage) {
        return res.status(400).json({ error: 'Invalid decryption key' });
      }
      
      // Optional: Delete the message after it's been read for true one-time use
      // await dynamoDB.delete({
      //   TableName: DYNAMO_TABLE_NAME,
      //   Key: { messageId }
      // }).promise();
      // 
      // await s3.deleteObject({
      //   Bucket: S3_BUCKET_NAME,
      //   Key: `messages/${messageId}`
      // }).promise();
      
      res.status(200).json({ message: decryptedMessage });
      
    } catch (error) {
      console.error('Decryption error:', error);
      res.status(400).json({ error: 'Invalid decryption key' });
    }
    
  } catch (error) {
    console.error('Error decrypting message:', error);
    res.status(500).json({ error: 'Failed to decrypt message' });
  }
};