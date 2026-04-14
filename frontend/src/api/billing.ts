import api from "./client";

export async function createCheckoutSession(): Promise<string> {
  const res = await api.post<{ url: string }>("/billing/create-checkout-session");
  return res.data.url;
}

export async function getPortalUrl(): Promise<string> {
  const res = await api.get<{ url: string }>("/billing/portal");
  return res.data.url;
}
