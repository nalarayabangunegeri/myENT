// Feed iCal minimal (pengganti integrasi kalender penuh, backlog §22.3).
export function toIcs(events: { id: string; title: string; start: Date; end: Date }[]): string {
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const vevents = events
    .map((e) => `BEGIN:VEVENT\r\nUID:${e.id}@jurnalistik\r\nDTSTART:${f(e.start)}\r\nDTEND:${f(e.end)}\r\nSUMMARY:${esc(e.title)}\r\nEND:VEVENT`)
    .join('\r\n');
  return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//UKM Jurnalistik//ID\r\n${vevents}\r\nEND:VCALENDAR\r\n`;
}
