"use server";

import { redirect } from "next/navigation";
import { createEditableEvent } from "@/lib/events";

import { auth } from "@/auth";

export async function createEvent(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const title = (formData.get("title") as string)?.trim();

  if (!title) throw new Error("Event title is required");

  const eventId = await createEditableEvent({ userId: session.user.id, title });

  redirect(`/hub/events/${eventId}`);
}
