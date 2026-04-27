import { MobileFrame } from '@/components/mobile-frame';
import { ListingCreationFlow } from './listing-creation-flow';

export const metadata = {
  title: 'New listing — Iloja',
};

export default function NewListingPage() {
  return (
    <MobileFrame>
      <ListingCreationFlow />
    </MobileFrame>
  );
}
