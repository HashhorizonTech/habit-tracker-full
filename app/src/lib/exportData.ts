// "Export data (CSV · JSON)": pulls the export from the server (docs/API.md) so it
// includes everything synced, writes it to a cache file and opens the share sheet.
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { api, ApiError } from '@/api/client';
import { syncNow } from '@/api/sync';
import { dateKey } from '@/data/dates';
import { toast } from '@/store/ui';

export async function exportData(format: 'csv' | 'json'): Promise<void> {
  try {
    await syncNow(); // make sure recent local edits are included
    const body = await api<unknown>(`/v1/export?format=${format}`, { method: 'GET', raw: true });
    const text = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
    const name = `tend-data-${dateKey()}.${format}`;
    if (Platform.OS === 'web') {
      const url = URL.createObjectURL(new Blob([text], { type: format === 'csv' ? 'text/csv' : 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const file = new File(Paths.cache, name);
      if (file.exists) file.delete();
      file.create();
      file.write(text);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: format === 'csv' ? 'text/csv' : 'application/json', dialogTitle: 'Export Tend data' });
      }
    }
    toast(`Export ready · ${name}`, 'download');
  } catch (e) {
    toast(e instanceof ApiError && e.offline ? 'Export needs a connection — try again soon' : 'Export didn’t work just now', 'download');
  }
}
