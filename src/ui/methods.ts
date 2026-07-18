/**
 * Methods & Limitations page — renders the repo's ACTUAL METHODS.md plus the README's
 * "Limitations, structured" table, imported as raw text at build time. Nothing is retyped
 * or summarized here: the page cannot drift from the documents because it IS the documents.
 */
import './styles.css';
import { marked } from 'marked';
import { renderProvenance } from './provenance.js';
import { renderVersion } from './version.js';
import methodsMd from '../../METHODS.md?raw';
import readmeMd from '../../README.md?raw';

/** Extract one `#### Heading` section (heading line included) from README markdown. */
function extractSection(md: string, heading: string): string {
  const start = md.indexOf(`#### ${heading}`);
  if (start === -1) return '';
  const rest = md.slice(start + 5 + heading.length);
  const next = rest.search(/\n#{2,4} /); // next heading of depth 2–4
  return `#### ${heading}\n${next === -1 ? rest : rest.slice(0, next)}`;
}

const limitations = extractSection(readmeMd, 'Limitations, structured');

const doc = document.getElementById('doc');
if (doc) {
  const methodsHtml = marked.parse(methodsMd, { async: false });
  const limitationsHtml = limitations
    ? `<section id="limitations">${marked.parse(limitations, { async: false })}</section>`
    : '';
  doc.innerHTML =
    methodsHtml +
    (limitationsHtml
      ? `<hr />${limitationsHtml}<p class="doc-note">This table is imported verbatim from the repository README
         (section “Limitations, structured”) — the same file a reviewer sees on GitHub.</p>`
      : '');
}

renderVersion();
renderProvenance(document.getElementById('provenance'));

// Support deep links like methods.html#limitations arriving before render completed.
if (location.hash) {
  const target = document.querySelector(location.hash);
  if (target) target.scrollIntoView();
}
