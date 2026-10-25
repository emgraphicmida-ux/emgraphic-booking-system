import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractAzDigits, formatAzLocalNumber, parseAzPhone, validateAzPhone, toAzInternationalFull } from '../src/utils/phoneUtils.ts';
import { cleanWhatsAppNumber } from '../src/utils/whatsappUtils.ts';
import { getLastBookableDate, isWithinBookingWindow } from '../src/utils/bookingWindow.ts';

test('99 numbers beginning 994 survive every typing step and all supported full-number paste formats', () => {
  const number = '994123456';
  for (let length = 1; length <= number.length; length++) {
    const typed = number.slice(0, length);
    assert.equal(extractAzDigits(formatAzLocalNumber(typed)), typed);
  }
  for (const value of ['+994 99 412 34 56', '994994123456', '00994994123456', '0994123456']) {
    assert.equal(extractAzDigits(value), number);
    assert.equal(parseAzPhone(value), number);
    assert.equal(cleanWhatsAppNumber(value), '994' + number);
  }
  assert.equal(cleanWhatsAppNumber(number), '994' + number);
  assert.equal(toAzInternationalFull(number), '+994 99 412 34 56');
});

test('server/client phone validation rejects fake, oversized and unexpected input consistently', () => {
  for (const invalid of ['000000000', '881234567', '50123456', '5012345678', '+99450<script>1234567', '50' + ' '.repeat(40000) + '1234567', null, {}, '501234567\n=1+2']) {
    assert.equal(parseAzPhone(invalid), '', String(invalid).slice(0, 40));
  }
  assert.equal(validateAzPhone('000000000').isValid, false);
  assert.equal(validateAzPhone('994123456').isValid, true);
  assert.equal(validateAzPhone('5012345678').isValid, false);
  assert.equal(parseAzPhone('00994501234567'), '501234567');
  assert.equal(parseAzPhone('+994 (50) 123-45-67'), '501234567');
});

test('booking horizon uses Baku calendar days across midnight and year boundaries', () => {
  const before = Date.parse('2026-12-31T23:59:59+04:00');
  const after = before + 1000;
  assert.equal(getLastBookableDate(before), '2027-03-31');
  assert.equal(getLastBookableDate(after), '2027-04-01');
  assert.equal(isWithinBookingWindow('2026-12-31', before), true);
  assert.equal(isWithinBookingWindow('2026-12-30', before), false);
  assert.equal(isWithinBookingWindow('2027-03-31', before), true);
  assert.equal(isWithinBookingWindow('2027-04-01', before), false);
  assert.equal(isWithinBookingWindow('9999-01-01', before), false);
  assert.equal(isWithinBookingWindow('2027-02-30', before), false);
});
