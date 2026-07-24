import { apiFetch } from '@/lib/api';
import { AvailabilityEditor } from '@/components/availability-editor';
import type { Availability } from '@/lib/types';

export default async function AvailabilityPage() {
  const availability = await apiFetch<Availability>('/availability');
  return (
    <>
      <h2>Availability</h2>
      <AvailabilityEditor initial={availability} />
    </>
  );
}
