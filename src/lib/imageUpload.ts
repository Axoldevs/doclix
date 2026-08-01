import { getSupabase } from '@/lib/supabase';

export class ImageUploadError extends Error {}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];

function randomSuffix() {
  return Math.random().toString(36).slice(2, 10);
}

export async function uploadSectionImage(file: File, ownerId: string): Promise<string> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new ImageUploadError('Only PNG, JPEG, GIF, WEBP, or SVG images are supported.');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ImageUploadError('Image is too large. Max size is 8MB.');
  }

  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'png';
  const path = `${ownerId}/${Date.now().toString(36)}-${randomSuffix()}.${ext}`;

  const supabase = getSupabase();
  const { error } = await supabase.storage.from('section-images').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });

  if (error) throw new ImageUploadError(error.message);

  const { data } = supabase.storage.from('section-images').getPublicUrl(path);
  return data.publicUrl;
}

const MAX_ICON_BYTES = 2 * 1024 * 1024; // 2MB — icons are small, keep uploads fast

export async function uploadProjectIcon(file: File, ownerId: string): Promise<string> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new ImageUploadError('Only PNG, JPEG, GIF, WEBP, or SVG images are supported.');
  }
  if (file.size > MAX_ICON_BYTES) {
    throw new ImageUploadError('Icon is too large. Max size is 2MB.');
  }

  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'png';
  const path = `${ownerId}/${Date.now().toString(36)}-${randomSuffix()}.${ext}`;

  const supabase = getSupabase();
  const { error } = await supabase.storage.from('project-icons').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });

  if (error) throw new ImageUploadError(error.message);

  const { data } = supabase.storage.from('project-icons').getPublicUrl(path);
  return data.publicUrl;
}
