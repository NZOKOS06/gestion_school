import { describe, it, expect } from 'vitest';
import { toMinutes, normalizeHHMM, overlaps, parsePlage } from './horaires.js';

describe('horaires', () => {
  it('convertit HH:MM en minutes, avec ou sans zéro initial', () => {
    expect(toMinutes('07:10')).toBe(430);
    expect(toMinutes('7:10')).toBe(430);
    expect(toMinutes('24:00')).toBeNull();
    expect(normalizeHHMM('7:45')).toBe('07:45');
  });

  it('créneaux contigus ne se chevauchent pas (07:10-07:45 puis 07:45-08:10)', () => {
    expect(overlaps(430, 465, 465, 490)).toBe(false);
  });

  it('détecte un chevauchement partiel à la minute', () => {
    expect(overlaps(430, 465, 460, 490)).toBe(true);
  });

  it('détecte un nouveau cours qui englobe un cours existant', () => {
    // 07:00-09:00 englobe 07:30-08:00
    expect(overlaps(420, 540, 450, 480)).toBe(true);
  });

  it('refuse une fin avant le début', () => {
    expect(parsePlage('08:10', '07:45').error).toBeTruthy();
    expect(parsePlage('7:10', '7:45')).toMatchObject({ debut: '07:10', fin: '07:45' });
  });
});
