# YouTube Template

Write a YouTube corpus in this exact Markdown-like format. Do not use JSON.

Top-level format:

# YouTube Corpus

Title: page title
Description: short listing description

--- VIDEO v1 ---
Title: video title
Channel: channel name
Uploaded: YYYY-MM-DD or approximate date
Views: 123456
Likes: 1234
Duration: 12:34

Description:
Video description text. Quotes, apostrophes, colons, and commas are allowed without escaping.

Comments:
- username [52]: Root comment text.
  - another_user [8]: Reply text. Use exactly two leading spaces for replies.
- third_user [19]: Another root comment.

--- VIDEO v2 ---
...

Rules:
- Generate 4-6 videos unless the user asks for a different amount.
- Each video delimiter must be exactly: --- VIDEO v1 --- then v2, v3, etc.
- Root comments start with "- ".
- Replies start with exactly two spaces and "- ".
- Use at most one reply level.
- Keep video descriptions and comments compact but specific.
- Later videos may reference earlier videos, comments, channels, or rumors.
- Earlier videos must not know later established facts, except as speculation.
- Mix news clips, reuploads, personal footage, commentary, low-quality recordings, and official statements where plausible.
