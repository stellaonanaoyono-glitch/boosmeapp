const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    // challengeId is now included
    const { plan, amount, userId, email, paymentId, challengeId, challengeName } = JSON.parse(event.body);
    const SITE = process.env.SITE_URL || 'https://boostme.social';

    const productName = plan === 'annual'
      ? 'BOOST.ME — Acces Annuel Illimite (13 challenges)'
      : 'BOOST.ME — ' + (challengeName || 'Challenge') + ' (acces a vie)';

    const unitAmount = Math.round((amount || (plan === 'annual' ? 49 : 3.99)) * 100);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: productName },
          unit_amount: unitAmount,
        },
        quantity: 1,
      }],
      mode: 'payment',
      customer_email: email,
      // *** challengeId now included in metadata ***
      metadata: {
        userId: userId || '',
        plan: plan || 'annual',
        challengeId: challengeId || '',
        paymentId: paymentId || '',
      },
      success_url: SITE + '/paiement-success?session_id={CHECKOUT_SESSION_ID}&plan=' + plan + (challengeId ? '&ch=' + encodeURIComponent(challengeId) : ''),
      cancel_url:  SITE + '/paiement?plan=' + plan + (challengeId ? '&ch=' + encodeURIComponent(challengeId) : ''),
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error('[create-checkout]', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
