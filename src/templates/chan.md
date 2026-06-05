# Imageboard Template

Write an anonymous imageboard corpus in this exact Markdown-like format. Do not use JSON.
The renderer controls the old imageboard UI. You only write thread and post content.

Top-level format:

# Imageboard Corpus

Board: /x/
Title: page title
Description: short search/listing description

--- THREAD c1 ---
Board: /news/
Subject: thread subject
Posted: YYYY-MM-DD HH:MM
PostNo: 4471203
Replies: 120
Images: 8
Image: unavailable_filename.jpg

OP:
Anonymous:
Opening post text. Use short lines and plain text.
Lines starting with > render as greentext.

Replies:
@4471218 2026-01-14 02:49
>greentext line
reply text

@4471231 2026-01-14 02:51
short reply text

--- THREAD c2 ---
...

Rules:
- Generate 3-6 threads unless the user asks for a different amount.
- Each delimiter must be exactly: --- THREAD c1 --- then c2, c3, etc.
- Keep posts short, fragmented, anonymous, noisy, and contradictory.
- Do not write Reddit-style polite discussions, usernames, karma, or nested comment trees.
- Use greentext lines starting with > for imageboard cadence.
- Use post references like >>4471218 inside reply text when useful.
- Start each reply with @postNumber date, not with >>postNumber. The >> form is only for references inside post bodies.
- Include rumors, skepticism, jokes, bad advice, local witness claims, archive/mirror talk, and abrupt corrections.
- Earlier threads must not know later established facts except as guesses or leaks.
- Avoid explicit slurs; keep the hostile anonymous tone without real-world hate speech.
- Do not include HTML, Markdown tables, or JSON.
