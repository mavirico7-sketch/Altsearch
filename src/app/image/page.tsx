import ImageGenerator from "@/components/ImageGenerator";

export default function ImagePage() {
  return (
    <main className="image-test-page">
      <h1>Image generation</h1>

      <p>
        Test image generation through the OpenAI-compatible OpenRouter API.
      </p>

      <ImageGenerator />
    </main>
  );
}
