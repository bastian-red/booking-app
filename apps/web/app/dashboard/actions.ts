'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eventTypeInputSchema, setAvailabilitySchema } from '@booking/shared';
import { apiFetch, ApiError } from '@/lib/api';
import { hhmmToMinutes } from '@/lib/types';

export type FormState = { error?: string } | undefined;

function parseEventTypeForm(formData: FormData) {
  const priceRaw = String(formData.get('priceCents') ?? '0');
  return eventTypeInputSchema.safeParse({
    title: formData.get('title'),
    slug: formData.get('slug'),
    description: formData.get('description') || undefined,
    durationMinutes: Number(formData.get('durationMinutes')),
    priceCents: priceRaw === '' ? 0 : Number(priceRaw),
    currency: String(formData.get('currency') || 'usd'),
    bufferBeforeMin: Number(formData.get('bufferBeforeMin') || 0),
    bufferAfterMin: Number(formData.get('bufferAfterMin') || 0),
    isActive: formData.get('isActive') === 'on',
  });
}

export async function createEventType(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseEventTypeForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  try {
    await apiFetch('/event-types', { method: 'POST', body: JSON.stringify(parsed.data) });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    throw err;
  }
  revalidatePath('/dashboard');
  redirect('/dashboard');
}

export async function updateEventType(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseEventTypeForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  try {
    await apiFetch(`/event-types/${id}`, { method: 'PATCH', body: JSON.stringify(parsed.data) });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    throw err;
  }
  revalidatePath('/dashboard');
  redirect('/dashboard');
}

export async function deleteEventType(formData: FormData): Promise<void> {
  const id = String(formData.get('id'));
  await apiFetch(`/event-types/${id}`, { method: 'DELETE' });
  revalidatePath('/dashboard');
}

export async function saveAvailability(_prev: FormState, formData: FormData): Promise<FormState> {
  const timezone = String(formData.get('timezone') || 'UTC');
  const rules: { dayOfWeek: number; startMinute: number; endMinute: number }[] = [];
  for (let day = 0; day < 7; day++) {
    if (formData.get(`enabled-${day}`) !== 'on') continue;
    const start = hhmmToMinutes(String(formData.get(`start-${day}`) || '09:00'));
    const end = hhmmToMinutes(String(formData.get(`end-${day}`) || '17:00'));
    if (end > start) rules.push({ dayOfWeek: day, startMinute: start, endMinute: end });
  }
  const parsed = setAvailabilitySchema.safeParse({ timezone, rules });
  if (!parsed.success) return { error: 'Invalid availability (check times and timezone).' };
  try {
    await apiFetch('/availability', { method: 'PUT', body: JSON.stringify(parsed.data) });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    throw err;
  }
  revalidatePath('/dashboard/availability');
  return { error: undefined };
}
