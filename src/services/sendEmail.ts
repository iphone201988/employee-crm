import nodemailer from "nodemailer";

// Create a transporter object
const transport = nodemailer.createTransport({
    service: "Gmail",
    auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
    },
});

// Define email templates
const emailTemplates = {
    sendInviteLink: {
        subject: "You're Invited to Join Employee Crm",
        text: (link: string) =>
            `You have been invited to join Employee Crm. Please click the link below to set your password and get started:\n\n${link}`,
        html: (link: string) => `
            <div style="font-family: Arial, sans-serif; line-height: 1.5;">
                <h2>You're Invited to Join Employee Crm</h2>
                <p>You have been invited to join <strong>Employee Crm</strong>.</p>
                <p>Please click the button below to set your password and activate your account:</p>
                <a href="${link}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Set Password</a>
                <p>If the button doesn't work, copy and paste this URL into your browser:</p>
                <p>${link}</p>
            </div>
        `,
    },
};

// Helper function to generate the email body
function generateEmailBody(type: number, link: string) {
    // You can extend this to support multiple types
    switch (type) {
        case 1:
            const template = emailTemplates.sendInviteLink;
            return {
                subject: template.subject,
                text: template.text(link),
                html: template.html(link),
            };
        default:
            throw new Error("Invalid email type");
    }
}

// Send an email
export async function sendEmail(to: string, type: number, link: string) {
    try {
        const { subject, text, html } = generateEmailBody(type, link);

        await transport.sendMail({
            from: `"Employee Crm" <${process.env.SMTP_EMAIL}>`,
            to,
            subject,
            text,
            html,
            headers: {
                "X-Entity-Ref-ID": `email-${Date.now()}`,
            },
        });

        console.log("Email sent successfully");
    } catch (error) {
        console.error("Error sending email:", error);
        throw error;
    }
}
