(() => {
  'use strict';
  const DR = globalThis.DR;
  DR.copyText = answer => {
    const plain = value => value
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1 ($2)')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*|__|`/g, '')
      .replace(/\s+/g, ' ').trim();
    const sources = answer.sources.map(source => `${source.title}: ${source.url}`).join('; ');
    return `@Destiny ${plain(answer.question)} ${plain(answer.answer_markdown)}${sources ? ' Sources: ' + sources : ''} Stream: ${answer.stream_url}`;
  };
  DR.writeClipboard = async text => {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(text);
  };
})();
