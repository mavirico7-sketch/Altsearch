"use client";

import { FormEvent, useState } from "react";

type ImageResult = {
  imageUrl: string;
  text: string;
  model: string;
};

export default function ImageGenerator() {
  const [prompt, setPrompt] = useState("Generate a beautiful sunset over mountains");
  const [result, setResult] = useState<ImageResult | null>(null);
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);
    setIsPending(true);

    try {
      const res = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }

      setResult(data as ImageResult);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="image-lab">
      <form onSubmit={handleSubmit} className="image-lab-form">
        <div className="form-field">
          <label htmlFor="image-prompt">
            <strong>Prompt</strong>
          </label>
          <textarea
            id="image-prompt"
            name="prompt"
            rows={4}
            className="mw-input"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            required
          />
        </div>
        <div className="form-actions">
          <button type="submit" className="mw-ui-button mw-ui-progressive" disabled={isPending}>
            {isPending ? "Generating..." : "Generate image"}
          </button>
        </div>
      </form>

      {error && (
        <div className="error-box">
          <strong>Image generation failed.</strong> {error}
        </div>
      )}

      {result && (
        <div className="image-lab-result">
          <div className="thumb-caption">Generated with {result.model}</div>
          <img src={result.imageUrl} alt={prompt} className="image-lab-output" />
          {result.text && <p className="muted">{result.text}</p>}
        </div>
      )}
    </div>
  );
}
