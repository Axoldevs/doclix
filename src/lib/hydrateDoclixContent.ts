/**
 * Hydrates the interactive bits of server/client-rendered DOCLIX markup
 * (".doclix-prose" HTML produced by renderMarkdown) inside a given
 * container: tab switching and code-block copy buttons.
 *
 * This is plain DOM/event-delegation code, not React, because the rendered
 * HTML comes from dangerouslySetInnerHTML (and, for the prerendered path,
 * from a Cloudflare Pages Function that has no React runtime at all) — a
 * single delegated listener on the container handles all tab groups and
 * copy buttons within it without needing per-element React state.
 *
 * Returns a cleanup function that removes the listeners; call it from a
 * useEffect's cleanup when the container unmounts or content changes.
 */
export function hydrateDoclixContent(container: HTMLElement): () => void {
  function onClick(e: MouseEvent) {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const tabBtn = target.closest<HTMLElement>('[data-doclix-tab-btn]');
    if (tabBtn) {
      const group = tabBtn.closest<HTMLElement>('[data-doclix-tabs]');
      if (!group) return;
      const index = tabBtn.getAttribute('data-tab-index');
      if (index === null) return;

      group.querySelectorAll<HTMLElement>('[data-doclix-tab-btn]').forEach((btn) => {
        btn.classList.toggle('doclix-tab-btn-active', btn === tabBtn);
      });
      group.querySelectorAll<HTMLElement>('[data-doclix-tab-panel]').forEach((panel) => {
        panel.classList.toggle('doclix-tab-panel-active', panel.getAttribute('data-tab-index') === index);
      });
      return;
    }

    const copyBtn = target.closest<HTMLElement>('[data-doclix-copy]');
    if (copyBtn) {
      const pre = copyBtn.closest('.doclix-codeblock')?.querySelector('pre code');
      const code = pre?.textContent ?? '';
      if (!code) return;
      navigator.clipboard
        .writeText(code)
        .then(() => {
          const label = copyBtn.querySelector('.doclix-copy-label');
          if (!label) return;
          const original = label.textContent;
          label.textContent = 'Copied!';
          copyBtn.classList.add('doclix-copy-btn-done');
          setTimeout(() => {
            label.textContent = original;
            copyBtn.classList.remove('doclix-copy-btn-done');
          }, 1500);
        })
        .catch(() => {
          /* clipboard unavailable — silently ignore, text remains selectable */
        });
    }
  }

  container.addEventListener('click', onClick);
  return () => container.removeEventListener('click', onClick);
}
