const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// All challenge IDs — hardcoded because there is no 'challenges' table
const ALL_CHALLENGE_IDS = [
  'cash-clarity','glow-up','mental-detox','morning-power',
  'unshakeable-confidence','body-reset','build-your-brand',
  'side-hustle-starter','own-the-room','deep-work-mode',
  'network-like-a-pro','read-and-lead'
];

async function activatePlan(userId, plan, challengeId) {
  console.log('[activate] userId:', userId, 'plan:', plan, 'challengeId:', challengeId);

  // 1. Update profile plan
  const planUpdate = {
    plan: plan,
    plan_updated_at: new Date().toISOString(),
    plan_expires_at: plan === 'annual'
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      : null,
  };
  const pr = await sb.from('profiles').update(planUpdate).eq('id', userId);
  if (pr.error) console.error('[activate] profile update error:', pr.error.message);
  else console.log('[activate] profile updated OK');

  if (plan === 'unit' && challengeId) {
    // Pause any currently active challenge (including boostme-starter)
    await sb.from('user_challenges')
      .update({ status: 'paused' })
      .eq('user_id', userId)
      .eq('status', 'active')
      .neq('challenge_id', challengeId);
    console.log('[activate] paused other active challenges for', userId);

    // 2a. Unit plan: activate the specific challenge
    const uc = await sb.from('user_challenges').upsert({
      user_id: userId,
      challenge_id: challengeId,
      current_day: 1,
      status: 'active',
      streak: 0,
      last_active: new Date().toISOString(),
    }, { onConflict: 'user_id,challenge_id' });
    if (uc.error) console.error('[activate] user_challenge upsert error:', uc.error.message);
    else console.log('[activate] challenge activated:', challengeId);

  } else if (plan === 'annual') {
    // 2b. Annual plan: mark all challenges as available (status=available, not active)
    // The user will start them one by one from the challenges page
    // But if they already have one active, don't touch it
    const { data: existing } = await sb
      .from('user_challenges')
      .select('challenge_id, status')
      .eq('user_id', userId);

    const existingMap = {};
    (existing || []).forEach(x => { existingMap[x.challenge_id] = x.status; });

    for (const chId of ALL_CHALLENGE_IDS) {
      if (!existingMap[chId]) {
        // Create with status 'available' so user can start them
        await sb.from('user_challenges').upsert({
          user_id: userId,
          challenge_id: chId,
          current_day: 1,
          status: 'available',
          streak: 0,
        }, { onConflict: 'user_id,challenge_id' });
      }
    }
    console.log('[activate] annual: all challenges marked available');
  }
}

exports.handler = async (event) => {
  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('[stripe-webhook] signature error:', err.message);
    return { statusCode: 400, body: 'Webhook signature invalid: ' + err.message };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const { userId, plan, challengeId, paymentId } = session.metadata || {};

    console.log('[stripe-webhook] session completed, metadata:', JSON.stringify(session.metadata));

    if (!userId || !plan) {
      console.error('[stripe-webhook] missing userId or plan in metadata');
      return { statusCode: 400, body: 'Missing metadata' };
    }

    // Activate plan and challenge
    await activatePlan(userId, plan, challengeId);

    // Send payment confirmation email
    try {
      const { data: prof } = await sb.from('profiles').select('prenom,email').eq('id', userId).single();
      const userEmail = prof?.email || session.customer_email || '';
      if (userEmail) {
        const https = require('https');
        const emailBody = JSON.stringify({
          email: userEmail, prenom: prof?.prenom || '',
          plan, challengeName: challengeId || '', amount: plan === 'annual' ? '49,00' : '3,99'
        });
        const siteUrl = new URL(process.env.SITE_URL || 'https://boostme.social');
        await new Promise((res) => {
          const r = https.request({ hostname: siteUrl.hostname, path: '/.netlify/functions/send-payment-confirm', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(emailBody) } }, (resp) => { resp.resume(); resp.on('end', res); });
          r.on('error', res); r.write(emailBody); r.end();
        });
      }
    } catch(emailErr) { console.warn('[stripe-webhook] email error:', emailErr.message); }

    // Update payment record status
    if (paymentId) {
      await sb.from('payments').update({
        status: 'confirmed',
        provider_ref: session.id,
        confirmed_at: new Date().toISOString(),
      }).eq('id', paymentId);
    } else {
      // Log payment even without paymentId
      await sb.from('payments').insert({
        user_id: userId,
        plan: plan,
        challenge_id: challengeId || null,
        amount_eur: plan === 'annual' ? 49 : 3.99,
        provider: 'stripe',
        provider_ref: session.id,
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
      });
    }
  }

  return { statusCode: 200, body: 'ok' };
};
