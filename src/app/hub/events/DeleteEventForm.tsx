"use client";

import { deleteEventAction } from "@/actions/delete-event";

export default function DeleteEventForm({ eventId }: { eventId: string }) {
  return (
    <form action={deleteEventAction} onSubmit={(e) => {
      if(!confirm("Are you sure you want to delete this event?")) e.preventDefault();
    }}>
      <input type="hidden" name="eventId" value={eventId} />
      <button type="submit" className="button" style={{ color: "#c5221f" }}>Delete</button>
    </form>
  );
}
