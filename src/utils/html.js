export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderTemplate(template, map) {
  return Object.entries(map).reduce(
    (acc, [key, value]) =>
      acc.replaceAll(`{${key}}`, key === 'url' ? value ?? '' : escapeHtml(value)),
    template,
  );
}

