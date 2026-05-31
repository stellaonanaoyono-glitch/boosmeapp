const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { plan, amount, userId, email, paymentId } = JSON.parse(event.body);

    const PRICES = {
      annual: { name: 'Accès Annuel Illimité BOOST.ME', price: 4900 }, // cents
      unit:   { name: 'Challenge BOOST.ME',             price:  399 },
    };

    const item = PRICES[plan] || PRICES.annual;
    const finalAmount = Math.round(amount * 100); // convert to cents

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: item.name },
          unit_amount: finalAmount,
        },
        quantity: 1,
      }],
      mode: 'payment',
      customer_email: email,
      metadata: { userId, plan, paymentId: paymentId || '' },
      success_url: process.env.SITE_URL + '/paiement-success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url:  process.env.SITE_URL + '/paiement?plan=' + plan,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
