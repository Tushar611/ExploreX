import * as FileSystem from "expo-file-system/legacy";
import { getApiUrl } from "./query-client";

interface UploadResult {
  success: boolean;
  url: string;
  fileName: string;
  fileType: string;
  size?: number;
}

function getFileName(uri: string, fallback: string): string {
  const fromUri = uri.split("/").pop();
  return fromUri && fromUri.length > 0 ? fromUri : fallback;
}

function inferMimeType(fileName: string, fallback: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    txt: "text/plain",
    m4a: "audio/m4a",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    aac: "audio/aac",
  };
  return map[extension] || fallback;
}

async function uploadToApi(uri: string, category: "photo" | "file" | "audio", fallbackName: string, fallbackType: string): Promise<UploadResult> {
  const fileInfo = await FileSystem.getInfoAsync(uri);
  if (!fileInfo.exists) {
    throw new Error("File does not exist");
  }

  const fileName = getFileName(uri, fallbackName);
  const fileType = inferMimeType(fileName, fallbackType);

  const body = new FormData();
  body.append("category", category);
  body.append("file", {
    uri,
    name: fileName,
    type: fileType,
  } as any);

  const baseUrl = getApiUrl();
  const uploadUrl = new URL("api/uploads", baseUrl).toString();

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
    },
    body,
  });

  const responseText = await response.text();
  let data: any = null;
  try {
    data = responseText ? JSON.parse(responseText) : null;
  } catch {
    data = null;
  }

  if (!response.ok || !data?.url) {
    const message = data?.error || responseText || `Upload failed (${response.status})`;
    throw new Error(message);
  }

  return {
    success: true,
    url: data.url,
    fileName,
    fileType,
    size: fileInfo.size,
  };
}

export function uploadPhoto(uri: string): Promise<UploadResult> {
  return uploadToApi(uri, "photo", `photo_${Date.now()}.jpg`, "image/jpeg");
}

export function uploadFile(uri: string, fileName?: string): Promise<UploadResult> {
  const fallback = fileName || `file_${Date.now()}`;
  return uploadToApi(uri, "file", fallback, "application/octet-stream");
}

export function uploadAudio(uri: string, fileName?: string): Promise<UploadResult> {
  const fallback = fileName || `audio_${Date.now()}.m4a`;
  return uploadToApi(uri, "audio", fallback, "audio/m4a");
}
