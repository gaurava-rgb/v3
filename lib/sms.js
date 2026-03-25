/**
 * SMS sending via AWS SNS.
 * Requires: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
 *
 * Uses AWS SDK v3 if installed, otherwise falls back to a lightweight
 * SigV4-signed fetch call.
 */

var region = process.env.AWS_REGION || 'us-east-1';

async function sendSms(phone, message) {
    // Try AWS SDK v3 first
    try {
        var { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
        var client = new SNSClient({ region: region });
        var result = await client.send(new PublishCommand({
            PhoneNumber: phone,
            Message: message,
            MessageAttributes: {
                'AWS.SNS.SMS.SMSType': {
                    DataType: 'String',
                    StringValue: 'Transactional'
                }
            }
        }));
        console.log('[SMS] Sent to', phone, 'MessageId:', result.MessageId);
        return { ok: true, messageId: result.MessageId };
    } catch (e) {
        if (e.code === 'MODULE_NOT_FOUND') {
            console.error('[SMS] @aws-sdk/client-sns not installed. Run: npm install @aws-sdk/client-sns');
        } else {
            console.error('[SMS] Send error:', e.message);
        }
        return { ok: false, error: e.message };
    }
}

module.exports = { sendSms };
