"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { deleteEventForUser } from "@/lib/events";

export async function deleteEventAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const eventId = formData.get("eventId");
  if (typeof eventId === "string" && eventId) {
    await deleteEventForUser(eventId, session.user.id);
  }
  redirect("/hub/events");
}
