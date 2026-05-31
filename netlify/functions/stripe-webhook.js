const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

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
    return { statusCode: 400, body: 'Webhook signature invalid' };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const { userId, plan, paymentId } = session.metadata;

    // Update profile plan
    await sb.from('profiles').update({
      plan: plan,
      plan_expires_at: plan === 'annual'
        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        : null,
    }).eq('id', userId);

    // Update payment record
    if (paymentId) {
      await sb.from('payments').update({
        status: 'confirmed',
        provider_ref: session.id,
        confirmed_at: new Date().toISOString(),
      }).eq('id', paymentId);
    }

    // Auto-start all challenges if annual
    if (plan === 'annual') {
      const { data: existing } = await sb
        .from('user_challenges')
        .select('challenge_id')
        .eq('user_id', userId);
      const existingIds = (existing || []).map(x => x.challenge_id);

      const { data: allCh } = await sb
        .from('challenges')
        .select('id')
        .eq('is_active', true)
        .neq('id', 'boostme-starter');

      for (const ch of (allCh || [])) {
        if (!existingIds.includes(ch.id)) {
          await sb.from('user_challenges').upsert({
            user_id: userId,
            challenge_id: ch.id,
            current_day: 1,
            status: 'inactive',
            streak: 0,
          }, { onConflict: 'user_id,challenge_id' });
        }
      }
    }
  }

  return { statusCode: 200, body: 'ok' };
};
