export function scrollCardRow(event: WheelEvent, row: HTMLElement) {
  if (event.ctrlKey || !event.cancelable || row.scrollWidth <= row.clientWidth) return;
  // Prefer an explicit sideways gesture. A vertical-only wheel moves the row sideways too.
  const delta = event.deltaX || event.deltaY;
  if (!delta) return;
  const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? row.clientWidth : 1;
  event.preventDefault();
  row.scrollLeft += delta * scale;
}
