import { PutObjectCommand, S3Client, ObjectCannedACL, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import dotenv from 'dotenv';
dotenv.config();

export const s3Client = new S3Client({
  region: process.env.AWS_REGION as string,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
});

const PUBLIC_BUCKET_NAME = process.env.AWS_PUBLIC_S3_BUCKET_NAME as string;
const PRIVATE_BUCKET_NAME = process.env.AWS_PRIVATE_S3_BUCKET_NAME as string;

export const uploadPublicFileToS3 = async (
  fileBuffer: Buffer,
  mimetype: string,
  key: string
): Promise<string> => {
  if (!PUBLIC_BUCKET_NAME) {
    throw new Error("AWS_PUBLIC_S3_BUCKET_NAME is not defined in environment variables.");
  }
  
  const uploadParams = {
    Bucket: PUBLIC_BUCKET_NAME,
    Key: key,
    Body: fileBuffer,
    ContentType: mimetype,
    ACL: 'public-read' as ObjectCannedACL, 
  };
  
  try {
    const command = new PutObjectCommand(uploadParams);
    await s3Client.send(command);
    const fileUrl = `https://${PUBLIC_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    return fileUrl;
  } catch (error) {
    console.error("Error uploading public file to S3:", error);
    throw new Error('Failed to upload public file to S3.');
  }
};

export const uploadPrivateFileToS3 = async (
  fileBuffer: Buffer,
  mimetype: string,
  key: string
): Promise<string> => {
  if (!PRIVATE_BUCKET_NAME) {
    throw new Error("AWS_PRIVATE_S3_BUCKET_NAME is not defined in environment variables.");
  }
  
  const uploadParams = {
    Bucket: PRIVATE_BUCKET_NAME,
    Key: key,
    Body: fileBuffer,
    ContentType: mimetype,
  };

  try {
    const command = new PutObjectCommand(uploadParams);
    await s3Client.send(command);
    const fileUrl = `https://${PRIVATE_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    return fileUrl;
  } catch (error) {
    console.error("Error uploading private file to S3:", error);
    throw new Error('Failed to upload private file to S3.');
  }
};

export const generatePresignedUploadUrl = async (key: string, contentType: string): Promise<string> => {
  if (!PRIVATE_BUCKET_NAME) {
    throw new Error("AWS_PRIVATE_S3_BUCKET_NAME is not defined in environment variables.");
  }
  const command = new PutObjectCommand({
    Bucket: PRIVATE_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3Client, command, { expiresIn: 900 }); 
};

export const generatePresignedDownloadUrl = async (
  key: string, 
  expiresInSeconds: number = 86400
): Promise<string> => {
  const command = new GetObjectCommand({
    Bucket: PRIVATE_BUCKET_NAME,
    Key: key,
  });
  
  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
};

export const generatePresignedViewUrl = async (key: string): Promise<string> => {
  if (!PRIVATE_BUCKET_NAME) {
    throw new Error("AWS_PRIVATE_S3_BUCKET_NAME is not defined.");
  }

  const command = new GetObjectCommand({
    Bucket: PRIVATE_BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn: 86400 });
};