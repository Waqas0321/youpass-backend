import QRCode from 'qrcode';

export async function buildStaffQrImageDataUrl(payload: string) {
  return QRCode.toDataURL(payload, {
    margin: 1,
    width: 256,
    color: {
      dark: '#111111',
      light: '#ffffff',
    },
  });
}
