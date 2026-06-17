export async function uploadImageToCloudinary(
  file: File | Blob,
  onProgress?: (percent: number) => void
): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error(
      "Image upload is not configured. Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET in your environment."
    );
  }

  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);
    formData.append("folder", "vivexa-courses");

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        const response = JSON.parse(xhr.responseText);
        resolve(response.secure_url as string);
      } else {
        reject(new Error("Image upload failed. Please try again."));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during image upload."));
    xhr.send(formData);
  });
}

export type RecordingUploadCategory = "general" | "course" | "live_class";

export type CloudinaryVideoUploadResult = {
  videoId: string;
  cloudinaryPublicId: string;
  secureVideoUrl: string;
  thumbnailUrl: string;
  duration: number;
  fileSize: number;
};

const RECORDING_FOLDERS: Record<RecordingUploadCategory, string> = {
  general: "recordings",
  course: "course-recordings",
  live_class: "live-class-recordings",
};

export function getRecordingFolder(category: RecordingUploadCategory = "course"): string {
  return RECORDING_FOLDERS[category];
}

export function buildVideoThumbnailFromPublicId(publicId: string): string {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloudName) return "";
  return `https://res.cloudinary.com/${cloudName}/video/upload/so_0,w_400,h_225,c_fill,q_auto/${publicId}.jpg`;
}

export async function uploadVideoToCloudinary(
  file: File,
  options: {
    category?: RecordingUploadCategory;
    onProgress?: (percent: number) => void;
  } = {}
): Promise<CloudinaryVideoUploadResult> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  const category = options.category ?? "course";
  const folder = getRecordingFolder(category);

  if (!cloudName || !uploadPreset) {
    throw new Error(
      "Video upload is not configured. Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET."
    );
  }

  const allowed = ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"];
  if (!allowed.includes(file.type) && !file.name.match(/\.(mp4|webm|mov|m4v)$/i)) {
    throw new Error("Please upload MP4, WebM, or MOV video files.");
  }

  const maxBytes = 500 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error("Video must be smaller than 500 MB.");
  }

  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);
    formData.append("folder", folder);
    formData.append("resource_type", "video");

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && options.onProgress) {
        options.onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status !== 200) {
        reject(new Error("Video upload failed. Check your Cloudinary upload preset allows video."));
        return;
      }
      try {
        const response = JSON.parse(xhr.responseText) as {
          public_id: string;
          secure_url: string;
          duration?: number;
          bytes?: number;
          asset_id?: string;
        };
        const publicId = response.public_id;
        resolve({
          videoId: response.asset_id || publicId,
          cloudinaryPublicId: publicId,
          secureVideoUrl: response.secure_url,
          thumbnailUrl: buildVideoThumbnailFromPublicId(publicId),
          duration: Math.round(response.duration || 0),
          fileSize: response.bytes || file.size,
        });
      } catch {
        reject(new Error("Invalid response from Cloudinary."));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during video upload."));
    xhr.send(formData);
  });
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatFileSize(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
