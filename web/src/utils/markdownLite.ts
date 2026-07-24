/**
 * Parser "lite" de Markdown — suporta apenas `**negrito**`.
 *
 * As notas de versão (`release-notes.json`) são escritas em Markdown por hábito
 * de quem redige, mas nenhum renderer (web/Android/iOS) faz parse — o resultado
 * é o usuário ver os asteriscos literais na tela (#3876).
 *
 * Deliberadamente não usamos uma lib de Markdown completa: o conteúdo é curto,
 * vem de uma fonte controlada (`scripts/release-notes.js`) e só precisa de
 * ênfase em negrito. Um parser mínimo evita dependência nova.
 */

export interface MarkdownLiteSegment {
  text: string;
  bold: boolean;
}

const BOLD_PATTERN = /\*\*(.+?)\*\*/g;

/**
 * Quebra `text` em segmentos de texto simples e negrito.
 * `**foo** bar **baz**` -> [{text:'foo',bold:true}, {text:' bar ',bold:false}, {text:'baz',bold:true}]
 */
export function parseMarkdownLite(text: string): MarkdownLiteSegment[] {
  if (!text) return [];

  const segments: MarkdownLiteSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  BOLD_PATTERN.lastIndex = 0;
  while ((match = BOLD_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), bold: false });
    }
    segments.push({ text: match[1], bold: true });
    lastIndex = BOLD_PATTERN.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), bold: false });
  }

  return segments;
}
