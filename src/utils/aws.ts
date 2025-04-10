import AWS from 'aws-sdk';
import dotenv from 'dotenv';

dotenv.config();

AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1' 
});

export const s3 = new AWS.S3();
export const dynamoDB = new AWS.DynamoDB.DocumentClient();

export const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || '';
export const DYNAMO_TABLE_NAME = process.env.DYNAMO_TABLE_NAME || '';