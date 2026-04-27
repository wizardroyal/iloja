import { MobileFrame } from '@/components/mobile-frame';
import { SavedSearches } from './saved-searches';

export const metadata = { title: 'Saved searches — Iloja' };

export default function SavedSearchesPage() {
  return (
    <MobileFrame>
      <SavedSearches />
    </MobileFrame>
  );
}
