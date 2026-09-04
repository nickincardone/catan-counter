import { isChatRowReady } from './messageOrderBuffer.js';

interface HistoryOptions {
  /** Preserve evidence in the game log even if a later gap blocks recovery. */
  onCapture?: (row: HTMLElement) => void;
  wait?: (ms: number) => Promise<void>;
  maxSweeps?: number;
  maxSteps?: number;
}

/** Collect the entire virtualized log before advancing the parser's watermark. */
export async function loadChatHistory(
  container: HTMLElement,
  processRow: (row: HTMLElement) => void,
  options: HistoryOptions = {}
): Promise<void> {
  const wait =
    options.wait ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const scroll = container.parentElement;
  const rows = new Map<number, HTMLElement>();
  let lastIndex = -1;
  const capture = () => {
    for (const row of container.querySelectorAll<HTMLElement>('[data-index]')) {
      const index = Number(row.dataset.index);
      if (!Number.isInteger(index) || index < 0) continue;
      lastIndex = Math.max(lastIndex, index);
      // HR is a real separator. An empty div is still waiting to render.
      if (isChatRowReady(row)) {
        rows.set(index, row.cloneNode(true) as HTMLElement);
        options.onCapture?.(row);
      }
    }
  };
  const complete = () => lastIndex >= 0 && rows.size === lastIndex + 1;
  const observer = new MutationObserver(capture);
  observer.observe(container, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['data-index', 'alt', 'src'],
  });
  capture(); // Remember the current tail, even before jumping to the beginning.

  try {
    for (let sweep = 0; sweep < (options.maxSweeps ?? 3); sweep++) {
      let target = 0;
      for (let step = 0; step < (options.maxSteps ?? 1000); step++) {
        if (scroll) scroll.scrollTop = target;
        await wait(step === 0 ? 120 : 90);
        capture();

        const maxScroll = scroll
          ? Math.max(0, scroll.scrollHeight - scroll.clientHeight)
          : 0;
        // Do not mistake an automatic jump to the live tail for scan progress.
        // Only our commanded position can end a pass; coverage must also agree.
        if (target >= maxScroll - 2) {
          if (complete()) {
            for (let index = 0; index <= lastIndex; index++)
              processRow(rows.get(index)!);
            return;
          }
          break;
        }
        const distance = Math.max(
          1,
          Math.floor((scroll?.clientHeight ?? 100) * 0.5)
        );
        target = Math.min(target + distance, maxScroll);
      }
    }
    throw new Error(
      `Chat history incomplete: captured ${rows.size} of ${lastIndex + 1} rows`
    );
  } finally {
    observer.disconnect();
    if (scroll) scroll.scrollTop = scroll.scrollHeight;
  }
}
