const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  const { paymentId, userId, plan } = event.queryStringParameters || {};

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const status = body.status || body.transaction?.status;

    if (status === 'complete' || status === 'success') {
      // Activate plan
      await sb.from('profiles').update({
        plan: plan,
        plan_expires_at: plan === 'annual'
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
          : null,
      }).eq('id', userId);

      // Update payment
      if (paymentId) {
        await sb.from('payments').update({
          status: 'confirmed',
          provider_ref: body.transaction?.reference || '',
          confirmed_at: new Date().toISOString(),
        }).eq('id', paymentId);
      }
    }

    return { statusCode: 200, body: 'ok' };
  } catch (err) {
    return { statusCode: 500, body: err.message };
  }
};
