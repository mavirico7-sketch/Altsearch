"use server";

import { getViewableEvent } from "@/lib/event-access";

export async function getEventTitleAction(eventId: string) {
  try {
    const event = await getViewableEvent(eventId);
    return event?.title || "Unknown Event";
  } catch (error) {
    return "Unknown Event";
  }
}
