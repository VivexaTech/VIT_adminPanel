import { v2 as cloudinary } from "cloudinary";

function ensureCloudinaryConfig() {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary server delete is not configured. Set CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET."
    );
  }
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
  return cloudName;
}

export async function deleteCloudinaryVideo(publicId: string): Promise<void> {
  if (!publicId?.trim()) return;
  ensureCloudinaryConfig();
  const result = await cloudinary.uploader.destroy(publicId, { resource_type: "video" });
  if (result.result !== "ok" && result.result !== "not found") {
    throw new Error(`Cloudinary delete failed: ${result.result}`);
  }
}

export function buildVideoThumbnailUrl(cloudName: string, publicId: string): string {
  return `https://res.cloudinary.com/${cloudName}/video/upload/so_0,w_400,h_225,c_fill,q_auto/${publicId}.jpg`;
}
