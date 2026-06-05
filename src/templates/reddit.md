# Reddit Template

Write a Reddit corpus in this exact Markdown-like format. Do not use JSON.

Top-level format:

# Reddit Corpus

Title: page title
Description: short listing description

--- POST r1 ---
Subreddit: worldnews
Title: post title
Author: username
Posted: YYYY-MM-DD or approximate date
Score: 123
Comments: 8

Body:
Post body text. Quotes, apostrophes, colons, and commas are allowed without escaping.

Comments:
- username [12]: Root comment text.
  - another_user [3]: Reply text. Use exactly two leading spaces for replies.
- third_user [7]: Another root comment.

--- POST r2 ---
...

Rules:
- Generate no more posts than the configured maximum.
- Each post delimiter must be exactly: --- POST r1 --- then r2, r3, etc.
- Root comments start with "- ".
- Replies start with exactly two spaces and "- ".
- Use at most one reply level.
- Keep comments short, like old Reddit discussions.
- Later posts may reference earlier posts, comments, or users.
- Earlier posts must not know later established facts, except as rumors or guesses.
- Include disagreement, jokes, skepticism, eyewitness claims, and moderation-like friction where plausible.
