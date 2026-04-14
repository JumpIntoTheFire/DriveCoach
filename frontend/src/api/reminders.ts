import api from "./client";

export interface ReminderResult {
  sms: { sent: boolean; error: string | null } | null;
  push: { sent: boolean; error: string | null } | null;
}

export async function sendManualReminder(lessonId: string): Promise<ReminderResult> {
  const res = await api.post<ReminderResult>(`/reminders/lessons/${lessonId}/remind`);
  return res.data;
}

export async function getVapidPublicKey(): Promise<string> {
  const res = await api.get<{ vapid_public_key: string }>("/push/vapid-public-key");
  return res.data.vapid_public_key;
}

export async function subscribeToPush(subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON();
  await api.post("/push/subscribe", {
    endpoint: json.endpoint,
    keys: json.keys,
  });
}

export async function unsubscribeFromPush(subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON();
  await api.delete("/push/unsubscribe", {
    data: { endpoint: json.endpoint, keys: json.keys },
  });
}
