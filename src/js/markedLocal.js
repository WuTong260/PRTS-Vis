function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function parseInline(text) {
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  return text;
}

export function parse(md) {
  if (!md) return '';
  var lines = md.split('\n');
  var html = '';
  var inCodeBlock = false;
  var codeContent = '';
  var inList = false;
  var listType = '';

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        html += '<pre><code>' + escapeHtml(codeContent.trim()) + '</code></pre>';
        codeContent = '';
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      if (inList) { html += (listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
      continue;
    }

    if (inCodeBlock) {
      codeContent += line + '\n';
      continue;
    }

    if (!trimmed) {
      if (inList) { html += (listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
      continue;
    }

    if (/^#{1,6}\s/.test(trimmed)) {
      if (inList) { html += (listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
      var level = trimmed.match(/^(#{1,6})/)[1].length;
      var hText = parseInline(escapeHtml(trimmed.replace(/^#{1,6}\s*/, '')));
      html += '<h' + level + '>' + hText + '</h' + level + '>';
      continue;
    }

    if (/^[-*_]{3,}$/.test(trimmed)) {
      if (inList) { html += (listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
      html += '<hr>';
      continue;
    }

    if (trimmed.startsWith('> ')) {
      if (inList) { html += (listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
      html += '<blockquote><p>' + parseInline(escapeHtml(trimmed.slice(2))) + '</p></blockquote>';
      continue;
    }

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      if (inList) { html += (listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
      var cells = trimmed.split('|').filter(function (c) { return c.trim(); });
      var isSep = /^\|[\s:-]+\|/.test(trimmed);
      if (isSep) continue;
      html += '<tr>';
      for (var c = 0; c < cells.length; c++) {
        var tag = (i > 0 && lines[i - 1] && lines[i - 1].trim().startsWith('|') && !/^\|[\s:-]+\|/.test(lines[i - 1].trim())) ? 'td' : 'th';
        html += '<' + tag + '>' + parseInline(escapeHtml(cells[c].trim())) + '</' + tag + '>';
      }
      html += '</tr>';
      continue;
    }

    if (/^[-*+]\s/.test(trimmed)) {
      if (!inList || listType !== 'ul') {
        if (inList) html += (listType === 'ul' ? '</ul>' : '</ol>');
        html += '<ul>';
        inList = true;
        listType = 'ul';
      }
      html += '<li>' + parseInline(escapeHtml(trimmed.replace(/^[-*+]\s*/, ''))) + '</li>';
      continue;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      if (!inList || listType !== 'ol') {
        if (inList) html += (listType === 'ul' ? '</ul>' : '</ol>');
        html += '<ol>';
        inList = true;
        listType = 'ol';
      }
      html += '<li>' + parseInline(escapeHtml(trimmed.replace(/^\d+\.\s*/, ''))) + '</li>';
      continue;
    }

    if (inList) { html += (listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
    html += '<p>' + parseInline(escapeHtml(trimmed)) + '</p>';
  }

  if (inList) html += (listType === 'ul' ? '</ul>' : '</ol>');
  if (inCodeBlock) html += '<pre><code>' + escapeHtml(codeContent.trim()) + '</code></pre>';

  return html;
}
