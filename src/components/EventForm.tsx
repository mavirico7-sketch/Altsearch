"use client";

import { useFormStatus } from "react-dom";
import { createEvent } from "@/actions/create-event";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="search-home-button" disabled={pending}>
      {pending ? "Creating..." : "Create event"}
    </button>
  );
}

export default function EventForm() {
  return (
    <form action={createEvent} className="event-form search-home-form">
      <div className="search-home-field">
        <label htmlFor="title">
          Search query
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          placeholder="e.g. Harran Necrotic Fever outbreak"
          className="search-home-input"
          maxLength={255}
        />
      </div>
      <div className="search-home-field">
        <label htmlFor="description">
          What should this internet know?
        </label>
        <textarea
          id="description"
          name="description"
          rows={6}
          required
          placeholder="Describe what you want to discuss first. This text will become the first message in Event Console."
          className="search-home-textarea"
        />
      </div>
      <div className="search-home-actions">
        <SubmitButton />
      </div>
    </form>
  );
}
