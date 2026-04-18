"use server";

import { redirect } from "next/navigation";

import { getServiceSupabase } from "@/lib/db/supabase";
import {
  ALLOWED_PHOTO_TYPES,
  MAX_PHOTO_BYTES,
  createCaseSchema,
} from "@/lib/schemas/case";

export type CreateCaseResult = { error: string };

export async function createCase(
  formData: FormData,
): Promise<CreateCaseResult | void> {
  const photo = formData.get("photo");
  if (!(photo instanceof Blob) || photo.size === 0) {
    return { error: "Photo is required." };
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    return { error: "Photo exceeds 10MB." };
  }
  const contentType = photo.type || "image/jpeg";
  if (!ALLOWED_PHOTO_TYPES.includes(contentType as (typeof ALLOWED_PHOTO_TYPES)[number])) {
    return { error: "Photo must be JPEG, PNG, or WebP." };
  }

  const parsed = createCaseSchema.safeParse({
    lat: formData.get("lat"),
    lng: formData.get("lng"),
    finder_email: formData.get("finder_email") ?? undefined,
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first?.message ?? "Invalid submission." };
  }
  const { lat, lng, finder_email } = parsed.data;

  const supabase = getServiceSupabase();

  const { data: inserted, error: insertError } = await supabase
    .from("cases")
    .insert({
      lat,
      lng,
      finder_email: finder_email ?? null,
      photo_path: "",
      status: "new",
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return { error: insertError?.message ?? "Failed to create case." };
  }

  const caseId = inserted.id as string;
  const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const photoPath = `cases/${caseId}/original.${ext}`;

  const buffer = Buffer.from(await photo.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from("photos")
    .upload(photoPath, buffer, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    await supabase.from("cases").delete().eq("id", caseId);
    return { error: `Upload failed: ${uploadError.message}` };
  }

  const { error: updateError } = await supabase
    .from("cases")
    .update({ photo_path: photoPath })
    .eq("id", caseId);

  if (updateError) {
    await supabase.storage.from("photos").remove([photoPath]);
    await supabase.from("cases").delete().eq("id", caseId);
    return { error: `Failed to finalize case: ${updateError.message}` };
  }

  redirect(`/case/${caseId}`);
}
