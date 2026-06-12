import type { JournalData } from '../types';
import { emptyJournal } from '../types';

/**
 * All persistence goes through this interface so a cloud adapter
 * (e.g. Supabase, for the Phase 2 social layer) can replace
 * localStorage without touching the rest of the app.
 */
export interface StorageAdapter {
  load(): JournalData;
  save(data: JournalData): void;
}

const KEY = 'trading-journal-v1';

export class LocalStorageAdapter implements StorageAdapter {
  load(): JournalData {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return emptyJournal();
      const parsed = JSON.parse(raw) as Partial<JournalData>;
      return { ...emptyJournal(), ...parsed };
    } catch {
      return emptyJournal();
    }
  }

  save(data: JournalData): void {
    localStorage.setItem(KEY, JSON.stringify(data));
  }
}
