// Computes the pixel position of the caret within a <textarea> by rendering
// a hidden mirror <div> with identical text/font styling, inserting a marker
// span at the caret position, and reading its offsetTop/offsetLeft.
// This is the standard technique used by editors like CodeMirror's older
// versions and various "@mention" / "/command" popup implementations.

const MIRROR_PROPERTIES = [
  'boxSizing',
  'width',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'letterSpacing',
  'lineHeight',
  'padding',
  'border',
  'whiteSpace',
  'wordWrap',
  'textIndent',
] as const;

export function getCaretCoordinates(textarea: HTMLTextAreaElement, position: number) {
  const div = document.createElement('div');
  const style = window.getComputedStyle(textarea);

  MIRROR_PROPERTIES.forEach((prop) => {
    div.style.setProperty(
      prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`),
      style.getPropertyValue(prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`))
    );
  });

  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.style.overflow = 'hidden';
  div.style.top = '0';
  div.style.left = '-9999px';
  div.style.height = 'auto';

  const value = textarea.value;
  const before = value.slice(0, position);
  const after = value.slice(position) || '.';

  div.textContent = before;
  const span = document.createElement('span');
  span.textContent = after;
  div.appendChild(span);

  document.body.appendChild(div);
  const { offsetTop, offsetLeft } = span;
  const lineHeight = parseInt(style.lineHeight, 10) || 20;
  document.body.removeChild(div);

  return {
    top: offsetTop - textarea.scrollTop,
    left: offsetLeft - textarea.scrollLeft,
    height: lineHeight,
  };
}
