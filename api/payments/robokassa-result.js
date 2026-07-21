import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { MerchantLogin, OutSum, InvId, SignatureValue } = req.body;

  // ПРОВЕРКА ПОДПИСИ (ОБЯЗАТЕЛЬНО!)
  const mySignature = crypto
    .createHash('md5')
    .update(`${process.env.ROBOKASSA_PASSWORD2}:${OutSum}:${InvId}`)
    .digest('hex')
    .toUpperCase();

  if (SignatureValue.toUpperCase() !== mySignature) {
    console.error('Invalid signature! Possible fraud attempt.');
    return res.status(403).send('Bad signature');
  }

  // Если подпись верная — обрабатываем платеж
  // ...
  
  res.send(`OK${InvId}`);
}