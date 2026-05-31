const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const ALL_CHALLENGE_IDS = [
  'cash-clarity','glow-up','mental-detox','morning-power',
  'unshakeable-confidence','body-reset','build-your-brand',
  'side-hustle-starter','own-the-room','deep-work-mode',
  'network-like-a-pro','read-and-lead'
];

// Verify payment status with NotchPay API
function verifyNP(reference, key) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.notchpay.co',
      path: '/payments/' + encodeURIComponent(reference),
      method: 'GET',
      headers: {
        'Authorization': key,
        'Accept': 'application/json',
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function activatePlan(userId, plan, challengeId) {
  console.log('[NP-activate] userId:', userId, 'plan:', plan, 'challengeId:', challengeId);

  // Update profile
  await sb.from('profiles').update({
    plan: plan,
    plan_updated_at: new Date().toISOString(),
    plan_expires_at: plan === 'annual'
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      : null,
  }).eq('id', userId);

  if (plan === 'unit' && challengeId) {
    // Activate specific challenge
    const r = await sb.from('user_challenges').upsert({
      user_id: userId,
      challenge_id: challengeId,
      current_day: 1,
      status: 'active',
      streak: 0,
      last_active: new Date().toISOString(),
    }, { onConflict: 'user_id,challenge_id' });
    if (r.error) console.error('[NP-activate] challenge upsert error:', r.error.message);
    else console.log('[NP-activate] challenge activated:', challengeId);

  } else if (plan === 'annual') {
    const { data: existing } = await sb
      .from('user_challenges')
      .select('challenge_id')
      .eq('user_id', userId);
    const existingIds = (existing || []).map(x => x.challenge_id);

    for (const chId of ALL_CHALLENGE_IDS) {
      if (!existingIds.includes(chId)) {
        await sb.from('user_challenges').upsert({
          user_id: userId,
          challenge_id: chId,
          current_day: 1,
          status: 'available',
          streak: 0,
        }, { onConflict: 'user_id,challenge_id' });
      }
    }
    console.log('[NP-activate] annual: all challenges available');
  }
}

exports.handler = async (event) => {
  const params = event.queryStringParameters || {};
  const { userId, plan, challengeId, ref } = params;

  console.log('[NP-webhook] params:', JSON.stringify(params));

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    console.log('[NP-webhook] body:', JSON.stringify(body));

    // Extract status from multiple possible formats
    const status = body.status ||
                   (body.transaction && body.transaction.status) ||
                   (body.data && body.data.status) ||
                   '';

    const reference = body.reference ||
                      (body.transaction && body.transaction.reference) ||
                      (body.data && body.data.reference) ||
                      ref || '';

    console.log('[NP-webhook] status:', status, 'reference:', reference);

    // NotchPay sends 'complete' or 'success' or 'successful'
    const isComplete = ['complete','success','successful','completed'].includes(
      (status || '').toLowerCase()
    );

    if (isComplete && userId && plan) {
      // Double-check with NotchPay API if we have a reference
      const key = process.env.NOTCHPAY_SECRET_KEY;
      if (key && reference) {
        try {
          const verify = await verifyNP(reference, key);
          console.log('[NP-webhook] verify response:', verify.status, JSON.stringify(verify.body));
          const verStatus = (verify.body && (verify.body.status || (verify.body.transaction && verify.body.transaction.status) || ''));
          const verified = ['complete','success','successful','completed'].includes((verStatus || '').toLowerCase());
          if (!verified) {
            console.warn('[NP-webhook] payment not verified, status:', verStatus);
            return { statusCode: 200, body: 'payment not complete' };
          }
        } catch(verifyErr) {
          // If verification fails, still trust the webhook (log only)
          console.warn('[NP-webhook] verification failed:', verifyErr.message, '- proceeding with activation');
        }
      }

      await activatePlan(userId, plan, challengeId);

      // Log payment
      await sb.from('payments').upsert({
        user_id: userId,
        plan: plan,
        challenge_id: challengeId || null,
        amount_eur: plan === 'annual' ? 49 : 3.99,
        amount_xaf: plan === 'annual' ? 32144 : 2616,
        provider: 'notchpay',
        provider_ref: reference,
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
      }, { onConflict: 'provider_ref' });

      console.log('[NP-webhook] activation complete for', userId);
    } else {
      console.log('[NP-webhook] not activating - isComplete:', isComplete, 'userId:', userId, 'plan:', plan);
    }

    return { statusCode: 200, body: 'ok' };
  } catch (err) {
    console.error('[NP-webhook] Error:', err.message);
    return { statusCode: 500, body: err.message };
  }
};
