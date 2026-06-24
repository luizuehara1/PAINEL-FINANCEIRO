/**
 * Cloudinary file upload utility
 */

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
  tipo: string;
  formato: string;
  nome: string;
}

export async function uploadToCloudinary(file: File): Promise<CloudinaryUploadResult> {
  if (!file) {
    throw new Error("Nenhum arquivo selecionado.");
  }

  const maxSize = 10 * 1024 * 1024;

  if (file.size > maxSize) {
    throw new Error("O arquivo precisa ter no máximo 10MB.");
  }

  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/pdf",
  ];

  if (!allowedTypes.includes(file.type)) {
    throw new Error("Formato inválido. Envie JPG, PNG, WEBP ou PDF.");
  }

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error("Cloudinary não configurado. Verifique o .env.local.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", "financeiro/notas");

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error("Erro Cloudinary:", data);
    throw new Error(data.error?.message || "Erro ao enviar arquivo para o Cloudinary.");
  }

  return {
    url: data.secure_url,
    publicId: data.public_id,
    tipo: data.resource_type,
    formato: data.format,
    nome: data.original_filename || file.name,
  };
}
