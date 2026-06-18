/** Map a click position to a character offset within a root element's text. */
export function getCaretOffsetFromPoint(
  root: HTMLElement,
  clientX: number,
  clientY: number
): number | null {
  let range: Range | null = null;

  if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(clientX, clientY);
  } else {
    const doc = document as Document & {
      caretPositionFromPoint?(
        x: number,
        y: number
      ): { offsetNode: Node; offset: number } | null;
    };
    const position = doc.caretPositionFromPoint?.(clientX, clientY);
    if (position) {
      range = document.createRange();
      range.setStart(position.offsetNode, position.offset);
      range.collapse(true);
    }
  }

  if (!range || !root.contains(range.startContainer)) {
    return null;
  }

  return getTextOffsetInRoot(root, range.startContainer, range.startOffset);
}

function getTextOffsetInRoot(
  root: HTMLElement,
  targetNode: Node,
  targetOffset: number
): number {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let offset = 0;
  let node: Node | null;

  while ((node = walker.nextNode())) {
    if (node === targetNode) {
      return offset + targetOffset;
    }
    offset += (node.textContent ?? "").length;
  }

  return offset;
}
