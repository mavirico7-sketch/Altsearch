import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getEventById } from "./events";
import type { Event } from "./schema";

export async function eventAccess(eventId: string): Promise<{
  event: Event | null;
  userId: string | null;
  isOwner: boolean;
  canView: boolean;
}> {
  const event = eventId ? (await getEventById(eventId) ?? null) : null;
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const isOwner = !!event && !!userId && event.userId === userId;
  return {
    event,
    userId,
    isOwner,
    canView: !!event && (!event.isPrivate || isOwner),
  };
}

export async function getOwnedEvent(eventId: string) {
  const access = await eventAccess(eventId);
  return access.event && access.isOwner ? access.event : null;
}

export async function getViewableEvent(eventId: string) {
  const access = await eventAccess(eventId);
  return access.event && access.canView ? access.event : null;
}

export async function requireEventOwnerPage(eventId: string) {
  const event = await getOwnedEvent(eventId);
  if (!event) notFound();
  return event;
}

export async function requireEventViewerPage(eventId: string) {
  const event = await getViewableEvent(eventId);
  if (!event) notFound();
  return event;
}
