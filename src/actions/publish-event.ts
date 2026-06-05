"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { setEventPrivacyForUser } from "@/lib/events";

export async function publishEventAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const eventId = formData.get("eventId");
  const isPrivate = formData.get("isPrivate") === "true";
  
  if (typeof eventId === "string" && eventId) {
    await setEventPrivacyForUser(eventId, session.user.id, isPrivate);
    revalidatePath(`/hub/events/${eventId}`);
    revalidatePath(`/hub/events`);
  }
}
