import { getSignedUrl } from "@aws-sdk/cloudfront-signer";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN as string;
const CLOUDFRONT_KEY_PAIR_ID = process.env.CLOUDFRONT_KEY_PAIR_ID as string;
const CLOUDFRONT_PRIVATE_KEY_PATH = process.env.CLOUDFRONT_PRIVATE_KEY_PATH as string;

let cloudFrontPrivateKey: string;
if (CLOUDFRONT_PRIVATE_KEY_PATH) {
    if (CLOUDFRONT_PRIVATE_KEY_PATH.includes('\n') || CLOUDFRONT_PRIVATE_KEY_PATH.includes('-----BEGIN')) {
        cloudFrontPrivateKey = CLOUDFRONT_PRIVATE_KEY_PATH;
    } else {
        try {
            const fullPath = join(__dirname, CLOUDFRONT_PRIVATE_KEY_PATH);
            if (existsSync(fullPath)) {
                cloudFrontPrivateKey = readFileSync(fullPath, "utf8");
            } else {
                cloudFrontPrivateKey = CLOUDFRONT_PRIVATE_KEY_PATH;
            }
        } catch (error) {
            cloudFrontPrivateKey = CLOUDFRONT_PRIVATE_KEY_PATH;
        }
    }
} else {
    throw new Error("CLOUDFRONT_PRIVATE_KEY_PATH environment variable is not set.");
}

export const generateSignedCloudFrontUrl = (resourcePath: string): string => {
    if (!CLOUDFRONT_DOMAIN || !CLOUDFRONT_KEY_PAIR_ID || !cloudFrontPrivateKey) {
        throw new Error("CloudFront environment variables are not configured correctly.");
    }
    const cleanResourcePath = resourcePath.startsWith('/') ? resourcePath.slice(1) : resourcePath;
    
    const url = `https://${CLOUDFRONT_DOMAIN}/${cleanResourcePath}`;
    const expirationDate = new Date(Date.now() + 3600 * 1000); // 1 hour expiration
    
    return getSignedUrl({
        url,
        keyPairId: CLOUDFRONT_KEY_PAIR_ID,
        privateKey: cloudFrontPrivateKey,
        dateLessThan: expirationDate.toISOString(),
    });
};