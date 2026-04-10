// src/utils/emailService.ts

const EMAIL_API_URL = 'https://my-emailer.vercel.app/api/send-email';

export const sendNotificationEmail = async (
    to: string,
    subject: string,
    htmlData: string,
    appName: string = 'Box Tracking App',
) => {
    try {
        const response = await fetch(EMAIL_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ to, subject, htmlData, appName }),
        });

        const data = await response.json();
        if (!data.success) {
            console.error('Failed to send email via API:', data.error);
        } else {
            console.log(`Email sent successfully to ${to}`);
        }
    } catch (error) {
        console.error('Network error while sending email:', error);
    }
};