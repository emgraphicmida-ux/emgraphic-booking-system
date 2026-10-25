import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { apiService } from '../src/services/apiService.ts';
import { createBookingsCsv, escapeCsvCell } from '../src/services/storageService.ts';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test('customer booking read distinguishes server/network/invalid responses from an empty list', async () => {
  globalThis.fetch = async () => reply({ error: 'Storage unavailable' }, 500);
  await assert.rejects(apiService.getMyBookings(), /Sifarişlər alına bilmədi/);
  globalThis.fetch = async () => { throw new Error('Connection interrupted'); };
  await assert.rejects(apiService.getMyBookings(), /Connection interrupted/);
  globalThis.fetch = async () => reply({ success: true });
  await assert.rejects(apiService.getMyBookings(), /düzgün qeydiyyat/);
  globalThis.fetch = async () => reply({ success: true, bookings: [] });
  assert.deepEqual(await apiService.getMyBookings(), []);
});

test('admin settings never accept offline fallback as editable server data', async () => {
  const saved = { whatsappNumber: '+994 50 222 33 44', studioAddress: 'Sınaq studiyasının yeni ünvanı', studioName: 'Sınaq Studio' };
  globalThis.fetch = async () => reply({ success: true, settings: saved });
  assert.deepEqual(await apiService.getSettingsStrict(), saved);
  globalThis.fetch = async () => reply({ error: 'Storage unavailable' }, 503);
  await assert.rejects(apiService.getSettingsStrict(), /Studiya məlumatları yüklənmədi/);
  assert.deepEqual(await apiService.getSettings(), saved, 'public display retains the last verified contacts');
  globalThis.fetch = async () => reply({ settings: { whatsappNumber: 123 } });
  await assert.rejects(apiService.getSettingsStrict(), /düzgün studiya/);
});

// Independent RFC4180-style reader verifies cell boundaries, embedded newlines and quotes.
function parseCsv(input) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = input.charCodeAt(0) === 0xFEFF ? 1 : 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') {
      if (quoted && input[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (c === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && input[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  assert.equal(quoted, false, 'CSV quotes must be balanced');
  row.push(cell); rows.push(row); return rows;
}

test('CSV preserves text and cell boundaries while preventing spreadsheet formula prefixes', () => {
  const booking = {
    id: 'synthetic-export', referenceCode: 'EM-TEST', clientName: '=1+2', clientPhone: '+994 50 123 45 67',
    photoshootType: '1 dekor (20-25 kadr fotoşəkil)', date: '2026-10-01', timeSlot: '10:00',
    notes: '@SUM(1,2) "qeyd"\r\nİkinci sətir', status: 'completed', createdAt: '2026-09-30T10:00:00Z',
  };
  const rows = parseCsv(createBookingsCsv([booking], Date.parse('2026-10-02T10:00:00Z')));
  assert.equal(rows.length, 2);
  assert.equal(rows[0].length, 10);
  assert.equal(rows[1].length, 10, 'commas, quotes and newlines stay inside their original cell');
  assert.equal(rows[1][1], '\t=1+2');
  assert.equal(rows[1][2], '\t+994 50 123 45 67');
  assert.equal(rows[1][8], '\t' + booking.notes);
  assert.equal(rows[1][6], 'Çəkiliş oldu');
  for (const text of ['=1+2', '+1+2', '-1+2', '@SUM(1,2)', '  =1+2', '\r=1+2', '＝1+2', '＋1+2', '－1+2', '＠SUM(1,2)']) {
    assert.equal(parseCsv(escapeCsvCell(text))[0][0], '\t' + text);
  }
  assert.equal(parseCsv(escapeCsvCell('Leyla, "Əliyeva"'))[0][0], 'Leyla, "Əliyeva"');
});
