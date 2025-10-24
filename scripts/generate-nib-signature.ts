import crypto from 'crypto';

type Inputs = {
  paidAmount: string | number;
  paidByNumber: string;
  txnRef: string;
  transactionId: string;
  transactionTime: string;
  accountNo: string;
  token: string;
};

function buildSignatureString(i: Inputs): string {
  return [
    `paidAmount=${i.paidAmount}`,
    `paidByNumber=${i.paidByNumber}`,
    `txnRef=${i.txnRef}`,
    `transactionId=${i.transactionId}`,
    `transactionTime=${i.transactionTime}`,
    `accountNo=${i.accountNo}`,
    `token=${i.token}`,
  ].join('&');
}

function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

// Example values matching src/app/api/payment/nib/notify/test.http
const inputs: Inputs = {
  paidAmount: 100,
  paidByNumber: '1234567890',
  txnRef: '1234567890',
  transactionId: '1234567890',
  transactionTime: '2021-01-01T00:00:00Z',
  accountNo: '1234567890',
  token: '1234567890',
};

const signatureString = buildSignatureString(inputs);
const signature = sha256Hex(signatureString);

console.log('Signature string:');
console.log(signatureString);
console.log('\nSHA-256 (hex) signature:');
console.log(signature);


