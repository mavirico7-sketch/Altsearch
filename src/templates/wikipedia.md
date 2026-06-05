Wikipedia HTML Article Fragment Template

Generate only the inner article HTML fragment for the current AltSearch Wikipedia-style page.
Do not generate a full standalone document.
Do not include <!DOCTYPE>, <html>, <head>, <style>, <body>, site header, search bar, page tabs, or footer.
The application already provides the outer page, CSS, tabs, sidebar, and footer.

Allowed HTML components:
- <h1 id="firstHeading">Article title</h1>
- <div class="hatnote">...</div>
- <div class="ambox ambox-notice|ambox-warning|ambox-serious">...</div>
- <table class="infobox">...</table>
- <p>...</p>
- <div id="toc">...</div>
- <h2 id="...">...</h2>, <h3 id="...">...</h3>, <h4 id="...">...</h4>
- <div class="thumb">...</div> and <div class="thumb left">...</div>
- <blockquote>...</blockquote>
- <div class="timeline-box">...</div>
- <table class="navbox">...</table>
- <div class="reflist"><ol>...</ol></div>
- <div id="catlinks">...</div>
- <div class="clearfix"></div>

Article size requirements unless the user explicitly asks for a short article:
- Long article: about 2500-5000 words.
- Lead: 4-5 paragraphs.
- At least 8 major sections.
- At least 6 subsections.
- At least 4 image placeholders or thumb blocks.
- At least 25 references for a full article.
- Include See also, References/Notes, Further reading when appropriate.
- For mysterious or controversial events, include Background/Chronology, Main phenomena, Testimony, Hypotheses, Official investigations, Criticism, and Culture/Society sections.

Writing style:
- Neutral, clinical, encyclopedic tone.
- Horror or mystery should come from precise facts, timestamps, contradictions, and institutional details, not dramatic adjectives.
- Use concrete dates, places, numbers, agencies, fictional researchers, reports, declassification notes, and realistic citations.
- Keep ambiguity where useful; do not over-explain fictional sources.
- Use red links with <a href="#" class="redlink">...</a> for plausible missing articles.
- Use footnote calls as <sup class="reference"><a href="#ref1">[1]</a></sup>.

Infobox pattern:
<table class="infobox">
  <tr><td colspan="2" class="infobox-title">Title</td></tr>
  <tr><td colspan="2" class="infobox-subtitle">Aliases · Alternate names</td></tr>
  <tr><td colspan="2" class="infobox-image">
    <div class="img-placeholder" style="width:100%;height:170px;">
      <div style="font-size:26px;">image</div>
      <div>Image unavailable</div>
      <div style="font-size:10px;">File:example_filename.jpg</div>
    </div>
    <div class="infobox-caption">Caption text.</div>
  </td></tr>
  <tr><td>Field</td><td>Value</td></tr>
</table>

Thumb image pattern:
<div class="thumb">
  <div class="thumbinner">
    <div class="figure-placeholder img-placeholder" style="width:230px;height:150px;">
      <div style="font-size:20px;">image</div>
      <div>File:example_filename.jpg</div>
    </div>
    <div class="thumbcaption">Caption with <a href="#">wikilinks</a>.</div>
  </div>
</div>

TOC pattern:
<div id="toc">
  <div id="toc-title">Contents</div>
  <ol>
    <li><a href="#section-id">Section name</a>
      <ol class="toc-sub">
        <li><a href="#subsection-id">Subsection</a></li>
      </ol>
    </li>
  </ol>
</div>

Timeline pattern:
<div class="timeline-box">
  <div class="timeline-title">Title</div>
  <div class="timeline-item">
    <div class="timeline-time">HH:MM</div>
    <div class="timeline-text">Description.</div>
  </div>
</div>

References pattern:
<div class="reflist">
  <ol>
    <li id="ref1">Author A. (Year). "Title". <i>Journal</i>, vol(issue), pp. pages.</li>
  </ol>
</div>

Category pattern:
<div id="catlinks">
  Categories: <a href="#">Category</a> | <a href="#">Another category</a>
</div>

Strictly forbidden:
- Markdown syntax.
- MediaWiki syntax such as {{Infobox}}, [[File:...]], [[Category:...]], <references />.
- Full-page HTML wrappers, embedded CSS, JavaScript, scripts, forms, iframes, external images, or remote resources.
- Prose preamble such as "Here is the article".

Return only the HTML fragment as the file content. The fragment must be self-contained article content and must render inside the existing application shell.
