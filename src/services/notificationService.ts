export interface NotificationPayload {
  toEmail?: string;
  pushToken?: string;
  subject?: string;
  message: string;
}

export async function sendNotification(payload: NotificationPayload) {
  try {
    const response = await fetch('/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error('Failed to send notification');
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
}
