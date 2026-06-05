# News Template

Write a news corpus in this exact Markdown-like format. Do not use JSON.
The website renderer controls layout and visuals. You only write article data.

Top-level format:

# News Corpus

Outlet: The Clarion
Tagline: Trusted independent journalism since 1961
Title: page title
Description: short search/listing description

--- ARTICLE n1 ---
Section: World
Title: article headline
Author: reporter name
Published: YYYY-MM-DD HH:MM UTC
Dateline: CITY
Summary: one or two sentences for the listing and article lead
Visual: building
ReadTime: 3 min read

Body:
Short article body. Use 3-7 concise paragraphs separated by blank lines.
Quotes, apostrophes, colons, and commas are allowed without escaping.

--- ARTICLE n2 ---
...

Rules:
- Generate 4-8 articles unless the user asks for a different amount.
- Each article delimiter must be exactly: --- ARTICLE n1 --- then n2, n3, etc.
- Articles must be chronological parts of the same event, from early reports to later consequences.
- The last chronological article becomes the main front-page story.
- Earlier articles must not know later established facts, except as rumors, speculation, or official denials.
- Keep articles shorter than Wikipedia: newsroom copy, not encyclopedia prose.
- Use concrete datelines, institutions, witnesses, documents, and timestamps.
- Valid Visual values: building, chart, world, document, photo, alert.
- Do not include HTML, Markdown tables, images, or links in the file.
